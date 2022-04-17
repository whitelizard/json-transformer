import get from 'lodash.get';
import set from 'lodash.set';
import jsonLogic from 'json-logic-js';
import getTransformer from '../src';

describe('example 1 from README', () => {
  it('should execute example correctly', () => {
    expect.assertions(4);
    const offset = 16;
    const transform = getTransformer({
      transforms: {
        '%offset%': (x) => x + offset,
        '%ts%': Date.now,
        '%data%': [4, 7, 8, 10, 3, 1],
      },
    });
    const transformed = transform({
      values: ['%data%'],
      config: {
        width: ['%offset%', 100],
      },
      timestamp: ['%ts%'],
    });
    // console.log(transformed);
    expect(transformed.values[1]).toBe(7);
    expect(transformed.config.width).toBe(116);
    expect(typeof transformed.timestamp).toBe('number');
    expect(transformed.timestamp > 1500000000000).toBeTruthy();
  });
});

describe('example 2 from README', () => {
  it('should execute example correctly', () => {
    expect.assertions(5);
    const ctx = { offset: 16 };
    const transform = getTransformer({
      defaultLevel1Transform: (v, k) => get(set(ctx, k, v), k),
      transforms: {
        '%get%': (k) => get(ctx, k),
        '%+%': (args) => args.reduce((r, v) => r + v, 0),
        '%ts%': () => new Date(),
        '%data%': [4, 7, 8, 10, 3, 1],
        '%sqMap%': (a) => a.map((x) => x * x),
      },
    });
    const transformed = transform({
      values: ['%data%'],
      config: {
        width: ['%+%', ['%get%', 'offset'], 100],
        squares: ['%sqMap%', ['%get%', 'values']],
      },
      timestamp: ['%ts%'],
    });
    // console.log(transformed);
    expect(transformed.values[1]).toBe(7);
    expect(transformed.config.width).toBe(116);
    expect(transformed.config.squares[1]).toBe(49);
    expect(typeof transformed.timestamp).toBe('object');
    expect(transformed.timestamp.toString().length > 22).toBeTruthy();
  });
});

describe('simple external context', () => {
  it('should be possible to set up use of external context', () => {
    expect.assertions(2);
    const ctx = {};
    const transform = getTransformer({
      defaultLevel1Transform: (v, k) => get(set(ctx, k, v), k),
      transforms: {
        '%get%': (k) => get(ctx, k),
        '%*%': (args) => args.reduce((r, v) => r * v, 1),
        '%+%': (args) => args.reduce((r, v) => r + v, 0),
      },
    });
    const transformed = transform({
      a: 5,
      b: ['%*%', ['%get%', 'a'], 2],
      c: ['%+%', [['%get%', 'b'], 4]],
    });
    // console.log(transformed);
    expect(transformed.b).toBe(10);
    expect(transformed.c).toBe(14);
  });
});

describe('realistic', () => {
  it('should integrate with e.g. jsonLogic', () => {
    expect.assertions(3);
    let result;
    const response = {
      send: (msg) => {
        result = msg;
      },
    };
    const ctx = { msg: { type: 'temperature', payload: [24.3] } };
    // Used in README:
    const transformer = getTransformer({
      defaultLevel1Transform: (v, k) => {
        const res = jsonLogic.apply(v, ctx);
        set(ctx, k, res);
        return res;
      },
    });
    const tr = transformer({
      threshold: 22,
      isTemperature: { '===': [{ var: 'msg.type' }, 'temperature'] },
      warning: {
        and: [{ var: 'isTemperature' }, { '>': [{ var: 'msg.payload.0' }, { var: 'threshold' }] }],
      },
      message: {
        if: [{ var: 'warning' }, 'Temperature is high', undefined],
      },
    });
    if (tr.message) {
      response.send({ type: ctx.msg.type, message: tr.message });
    }
    // console.log(tr);
    expect(typeof result).toBe('object');
    expect(result.type).toBe('temperature');
    expect(result.message).toBe('Temperature is high');
  });
});

describe('leaf transform', () => {
  it('should have working leafTransform property', () => {
    expect.assertions(4);
    const transform = getTransformer({
      leafTransform: (arg) => (typeof arg === 'string' ? arg.toLowerCase() : arg),
    });
    const transformed = transform({
      a: 5,
      b: 'TEST',
      c: [['Tom', 'Stephen'], { KEY: 'VALUE' }],
    });
    // console.log(transformed);
    expect(transformed.a).toBe(5);
    expect(transformed.b).toBe('test');
    expect(transformed.c[0][0]).toBe('tom');
    expect(transformed.c[1].KEY).toBe('value');
  });
});

describe('defaultLevel1Transform', () => {
  it('defaultLevel1Transform', () => {
    expect.assertions(1);
    const transform = getTransformer({
      defaultLevel1Transform: jsonLogic.apply,
      rootToContext: false,
    });
    const result = transform({ result: { '>': [{ var: 'msg.pl.0' }, 10] } }, { msg: {} });
    // console.log('RESULT:', result);
    expect(!result.result).toBeTruthy();
  });
});

describe('functions in transformed object', () => {
  it('functions in transformed object', () => {
    expect.assertions(1);
    const transform = getTransformer();
    const transformed = transform({
      func: (x) => x * x,
    });
    // console.log(transformed);
    expect(transformed.func(5)).toBe(25);
  });
});

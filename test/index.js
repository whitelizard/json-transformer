import test from 'tape';
import get from 'lodash.get';
import set from 'lodash.set';
import jsonLogic from 'json-logic-js';
import getTransformer from '../src';

test('func, object, global', t => {
  const ctx = {};
  const transform = getTransformer({
    // console.log('defL1:', k, v);
    defaultLevel1Transform: (v, k) => get(set(ctx, k, v), k),
    transforms: {
      '%get%': k => get(ctx, k),
      '%sin%': Math.sin,
      '%Math%': Math,
      '%global%': arg => global[arg],
    },
  });
  const transformed = transform(JSON.parse(JSON.stringify({
    v: 2.1201,
    a: ['foo', { x: ['%sin%', ['%get%', 'v']] }],
  })));
  // console.log(transformed);
  t.equals(transformed.a[1].x, 0.8528882764707455);
  t.end();
});

test('README example 1', t => {
  const offset = 16;
  const transform = getTransformer({
    transforms: {
      '%offset%': x => x + offset,
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
  t.equals(transformed.values[1], 7);
  t.equals(transformed.config.width, 116);
  t.equals(typeof transformed.timestamp, 'number');
  t.ok(transformed.timestamp > 1500000000000);
  t.end();
});

test('README example 2', t => {
  const ctx = { offset: 16 };
  const transform = getTransformer({
    defaultLevel1Transform: (v, k) => get(set(ctx, k, v), k),
    transforms: {
      '%get%': k => get(ctx, k),
      '%+%': args => args.reduce((r, v) => r + v, 0),
      '%ts%': () => new Date(),
      '%data%': [4, 7, 8, 10, 3, 1],
      '%sqMap%': a => a.map(x => x * x),
    },
  });
  const transformed = transform({
    values: ['%data%'],
    config: {
      width: ['%+%', [['%get%', 'offset'], 100]],
      squares: ['%sqMap%', ['%get%', 'values']],
    },
    timestamp: ['%ts%'],
  });
  // console.log(transformed);
  t.equals(transformed.values[1], 7);
  t.equals(transformed.config.width, 116);
  t.equals(transformed.config.squares[1], 49);
  t.equals(typeof transformed.timestamp, 'object');
  t.ok(transformed.timestamp.toString().length > 22);
  t.end();
});

test('Transform arguments', t => {
  const transform = getTransformer({
    transforms: {
      '%one%': x => x + 1,
      '%two%': (a, b) => a + b,
      '%complex%': (a, b, c) => a.reduce(b, 0) + c,
    },
  });
  const transformed = transform({
    one: ['%one%', 5],
    two: ['%two%', 3, 4],
    complex: ['%complex%', [4, 3, 1], (r, x) => r + x, 5],
  });
  // console.log(transformed);
  t.equals(transformed.one, 6);
  t.equals(transformed.two, 7);
  t.equals(transformed.complex, 13);
  t.end();
});

test('Root Array + external context + altering flat transform args', t => {
  const vars = { foo: 'bar' };
  const transform = getTransformer({
    defaultLevel1Transform: (v, k) => get(set(vars, k, v), k),
    transforms: {
      '%get%': path => get(vars, path),
      '%set%': (path, value) => {
        set(vars, path, value);
        return value;
      },
    },
  });
  transform([['%set%', 'value', ['%get%', 'foo']], ['%set%', 'value2', ['%get%', 'none']]]);
  // console.log(transformed);
  t.equals(vars.value, 'bar');
  t.equals(vars.value2, undefined);
  t.end();
});

test('Simple external context', t => {
  const ctx = {};
  const transform = getTransformer({
    defaultLevel1Transform: (v, k) => get(set(ctx, k, v), k),
    transforms: {
      '%get%': k => get(ctx, k),
      '%*%': args => args.reduce((r, v) => r * v, 1),
      '%+%': args => args.reduce((r, v) => r + v, 0),
    },
  });
  const transformed = transform({
    a: 5,
    b: ['%*%', [['%get%', 'a'], 2]],
    c: ['%+%', [['%get%', 'b'], 4]],
  });
  // console.log(transformed);
  t.equals(transformed.b, 10);
  t.equals(transformed.c, 14);
  t.end();
});

test('default root transform', t => {
  const transform = getTransformer({
    transforms: {
      '%date%': () => new Date(),
      // '%jl%': (arg, ctx) => jsonLogic.apply(arg, ctx),
      '%global%': arg => ({ Date, Math }[arg]),
    },
    defaultRootTransform: jsonLogic.apply,
  });
  const transformed = transform({
    if: [{ '>': [['%date%'], 123] }, [5], [6]],
  });
  // console.log(transformed);
  t.same(transformed, [5]);
  const transformed2 = transform({
    if: [{ '<': [['%date%'], 123] }, [5], [6]],
  });
  // console.log(transformed2);
  t.same(transformed2, [6]);
  t.end();
});

test('default level 1 transform', t => {
  const transform = getTransformer({
    defaultLevel1Transform: () => 6,
  });
  const transformed = transform({
    a: 5,
  });
  // console.log(transformed);
  t.equals(transformed.a, 6);
  t.end();
});

test('realistic', t => {
  let result;
  const response = {
    send: msg => {
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
  t.equals(typeof result, 'object');
  t.equals(result.type, 'temperature');
  t.equals(result.message, 'Temperature is high');
  t.end();
});

test('leaf transform', t => {
  const transform = getTransformer({
    leafTransform: arg => (typeof arg === 'string' ? arg.toLowerCase() : arg),
  });
  const transformed = transform({
    a: 5,
    b: 'TEST',
    c: [['Tom', 'Stephen'], { KEY: 'VALUE' }],
  });
  // console.log(transformed);
  t.equals(transformed.a, 5);
  t.equals(transformed.b, 'test');
  t.equals(transformed.c[0][0], 'tom');
  t.equals(transformed.c[1].KEY, 'value');
  t.end();
});

test('leaf transform + default transform', t => {
  const transform = getTransformer({
    // transforms: exTransforms,
    leafTransform: x => x + 1,
    defaultLevel1Transform: x => x * 2,
  });
  const transformed = transform({
    a: 5,
  });
  // console.log(transformed);
  t.equals(transformed.a, 12);
  t.end();
});

test('defaultLevel1Transform', t => {
  const transform = getTransformer({
    defaultLevel1Transform: jsonLogic.apply,
    rootToContext: false,
  });
  const result = transform({ result: { '>': [{ var: 'msg.pl.0' }, 10] } }, { msg: {} });
  // console.log('RESULT:', result);
  t.ok(!result.result);
  t.end();
});

test('functions in transformed object', t => {
  const transform = getTransformer();
  const transformed = transform({
    func: x => x * x,
  });
  // console.log(transformed);
  t.equals(transformed.func(5), 25);
  t.end();
});

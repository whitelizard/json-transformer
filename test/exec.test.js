import get from 'lodash.get';
import set from 'lodash.set';
import isFunction from 'lodash.isfunction';
import jsonLogic from 'json-logic-js';
import getTransformer from '../src';

const exTransforms = {
  // '%global%': arg => (global || window)[arg],
  '%exec%': (arg) => {
    // console.log('%exec%:', arg);
    if (!Array.isArray(arg)) return arg;
    if (arg.length === 1) return arg[0];
    let [obj, member, ...args] = arg;
    let doNew;
    if (obj === 'new') {
      doNew = true;
      [obj, member, ...args] = [member, ...args];
    }
    if (Array.isArray(member)) {
      if (isFunction(obj)) {
        if (doNew) {
          /* eslint-disable new-cap */
          obj = new obj(...member);
          /* eslint-enable new-cap */
          doNew = false;
        } else {
          obj = obj(...member);
        }
      }
      [member, ...args] = args;
    }
    // console.log('%exec% MID:', obj, member, args);
    if (!args.length) {
      return !obj ? obj : !member ? obj : obj[member] ? obj[member] : arg;
    }
    /* eslint-disable functional/no-loop-statement, fp/no-loops */
    // for (const value of args)
    args.forEach((value) => {
      if (Array.isArray(value) && isFunction(obj[member])) {
        if (doNew) {
          /* eslint-disable new-cap */
          obj = new obj[member](...value);
          doNew = false;
          /* eslint-enable new-cap */
        } else {
          obj = obj[member](...value);
        }
      } else {
        obj = obj[member];
        member = value;
      }
    });
    /* eslint-enable functional/no-loop-statement */
    return obj;
  },
};

describe('func, object, exec & global', () => {
  it('should do everything right :P', () => {
    expect.assertions(6);
    const ctx = {};
    const transform = getTransformer({
      // console.log('defL1:', k, v);
      defaultLevel1Transform: (v, k) => get(set(ctx, k, v), k),
      transforms: {
        ...exTransforms,
        '%get%': (k) => get(ctx, k),
        '%sin%': Math.sin,
        '%Math%': Math,
        '%global%': (arg) => global[arg],
      },
    });
    const transformed = transform(
      JSON.parse(
        JSON.stringify({
          v: 2.1201,
          a: ['foo', { x: ['%sin%', ['%get%', 'v']] }],
          b: ['%exec%', [['%global%', 'Math'], 'cos', [['%get%', 'v']]]],
          c: ['%exec%', [['%Math%'], 'tan', [1]]],
          d: ['%exec%', ['test', 'length']],
          e: ['%exec%', ['new', ['%global%', 'Date'], [1522084491482]]],
          f: ['%exec%', ['new', ['%global%', 'Date'], [1522084491482], 'toISOString', []]],
        }),
      ),
    );
    // console.log(transformed);
    expect(transformed.a[1].x).toBe(0.8528882764707455);
    expect(transformed.b).toBe(-0.5220934665926794);
    expect(transformed.c).toBe(1.5574077246549023);
    expect(transformed.d).toBe(4);
    expect(transformed.e.toISOString()).toBe('2018-03-26T17:14:51.482Z');
    expect(transformed.f).toBe('2018-03-26T17:14:51.482Z');
  });
});

describe('root Array + external context + altering flat transform args', () => {
  it('should handle array as root, and argument sugar', () => {
    expect.assertions(2);
    const external = { foo: 'bar' };
    const transform = getTransformer({
      defaultLevel1Transform: (v, k) => get(set(external, k, v), k),
      transforms: {
        ...exTransforms,
        '%get%': (args) => get(external, args),
        '%set%': (args) => {
          set(external, ...args);
          return args[1];
        },
      },
    });
    transform([
      ['%set%', 'value', ['%exec%', [['%get%', 'foo'], 'length']]],
      ['%set%', ['value2', ['%exec%', ['%get%', 'none'], 'length']]],
    ]);
    // console.log(transformed);
    expect(external.value).toBe(3);
    expect(external.value2).toBeUndefined();
  });
});

describe('example: controlled global', () => {
  it('should not be able to affect external var', () => {
    expect.assertions(1);
    let value = 0; // eslint-disable-line
    const transform = getTransformer({
      transforms: {
        ...exTransforms,
        '%global%': (arg) => ({ Date, Math }[arg]),
      },
    });
    transform({
      b: [
        '%exec%',
        ['%global%', 'eval'],
        [
          `console.log('Testing eval!');
          value = 6;`,
        ],
      ],
      now: ['%exec%', ['%global%', 'Date'], 'now', []],
    });
    // console.log(transformed);
    expect(value).toBe(0);
    // expect(transformed.b).toBe(6);
  });
});

describe('default root transform', () => {
  it('should use root transform if given', () => {
    expect.assertions(2);
    const transform = getTransformer({
      transforms: {
        ...exTransforms,
        // '%jl%': (arg, ctx) => jsonLogic.apply(arg, ctx),
        '%global%': (arg) => ({ Date, Math }[arg]),
      },
      defaultRootTransform: jsonLogic.apply,
    });
    const transformed = transform({
      if: [{ '>': [['%exec%', [['%global%', 'Date'], 'now', []]], 123] }, [5], [6]],
    });
    // console.log(transformed);
    expect(transformed).toStrictEqual([5]);
    const transformed2 = transform({
      if: [{ '<': [['%exec%', ['%global%', 'Date'], 'now', []], 123] }, [5], [6]],
    });
    // console.log(transformed2);
    expect(transformed2).toStrictEqual([6]);
  });
});

describe('default level 1 transform', () => {
  it('should use level 1 transform if given', () => {
    expect.assertions(3);
    const transform = getTransformer({
      transforms: {
        // ...exTransforms,
        '%global%': (arg) => ({ Date, Math }[arg]),
      },
      defaultLevel1Transform: exTransforms['%exec%'],
    });
    const transformed = transform({
      a: 5,
      b: [5],
      c: [['%global%', 'Date'], 'now', []],
    });
    // console.log(transformed);
    expect(transformed.a).toBe(5);
    expect(transformed.b).toBe(5);
    expect(typeof transformed.c).toBe('number');
  });
});

describe('leaf transform + default transform', () => {
  it('leaf transform + default transform', () => {
    expect.assertions(4);
    const transform = getTransformer({
      // transforms: exTransforms,
      leafTransform: (arg) => (typeof arg === 'string' ? arg.toLowerCase() : arg),
      defaultLevel1Transform: exTransforms['%exec%'],
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

describe('realistic 2', () => {
  it('realistic 2', () => {
    expect.assertions(3);
    const globals = {
      Date,
    };
    const ctx = {
      msg: { pl: [261], ts: '1521667419.16' },
      previous: [{ ts: '1521660219.16', pl: [218] }],
    };
    const transform = getTransformer({
      defaultLevel1Transform: (v, k) => get(set(ctx, k, v), k),
      transforms: {
        ...exTransforms,
        '%get%': (k) => get(ctx, k),
        '%global%': (arg) => globals[arg],
        // '%_%': arg => _[arg],
        '%jl%': (v) => jsonLogic.apply(v, ctx),
      },
    });
    // const aTimestamp = 1521663819160 / 1000;
    const result = transform(
      {
        apiCalls: [['service/three', ['%jl%', { var: 'msg.ts' }]]],
        currentTime: [
          '%exec%',
          ['new', ['%global%', 'Date'], [['%jl%', { '*': [{ var: 'msg.ts' }, 1000] }]]],
        ],
        previousTime: [
          '%exec%',
          ['new', ['%global%', 'Date'], [['%jl%', { '*': [{ var: 'previous.0.ts' }, 1000] }]]],
        ],
        timeDiff: ['%jl%', { '-': [{ var: 'currentTime' }, { var: 'previousTime' }] }],
        rawDayOfCurrent: ['%exec%', [['%get%', 'currentTime'], 'getDay', []]],
        rawDayOfPrev: ['%exec%', [['%get%', 'previousTime'], 'getDay', []]],
      },
      ctx,
    );
    // console.log(result);
    // console.log(ctx);
    expect(result.apiCalls[0][1]).toBe('1521667419.16');
    expect(result.timeDiff).toBe(2 * 3600 * 1000);
    expect(ctx.timeDiff).toBe(2 * 3600 * 1000);
  });
});

describe('realistic 2, objectSyntax', () => {
  it('realistic 2, objectSyntax', () => {
    expect.assertions(2);
    const globals = {
      Date,
    };
    const aTimestamp = 1521663819160 / 1000;
    const ctx = { msg: { pl: [261], ts: String(aTimestamp), ct: String(aTimestamp - 3600) } };
    const transform = getTransformer({
      defaultLevel1Transform: (v, k) => get(set(ctx, k, v), k),
      transforms: {
        ...exTransforms,
        '%jl%': (v) => jsonLogic.apply(v, ctx),
        '%global%': (arg) => globals[arg],
      },
    });
    const result = transform({
      apiCalls: [['service/three', { '%jl%': { var: 'msg.ts' } }]],
      currentTime: {
        '%exec%': ['new', { '%global%': 'Date' }, [{ '%jl%': { '*': [{ var: 'msg.ts' }, 1000] } }]],
      },
      previousTime: {
        '%exec%': ['new', { '%global%': 'Date' }, [{ '%jl%': { '*': [{ var: 'msg.ct' }, 1000] } }]],
      },
      timeDiff: {
        '%jl%': { '-': [{ var: 'currentTime' }, { var: 'previousTime' }] },
      },
    });
    // console.log(result);
    expect(result.apiCalls[0][1]).toBe(String(aTimestamp));
    expect(result.timeDiff).toBe(3600 * 1000);
  });
});

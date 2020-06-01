import {test} from 'tap';
import get from 'lodash.get';
import set from 'lodash.set';
import isFunction from 'lodash.isfunction';
import jsonLogic from 'json-logic-js';
import getTransformer from '../src';

export const exTransforms = {
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
      /* eslint-disable no-nested-ternary */
      return !obj ? obj : !member ? obj : obj[member] ? obj[member] : arg;
      /* eslint-enable no-nested-ternary */
    }
    for (const value of args) {
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
    }
    return obj;
  },
};

test('func, object, exec & global', (t) => {
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
  t.equals(transformed.a[1].x, 0.8528882764707455);
  t.equals(transformed.b, -0.5220934665926794);
  t.equals(transformed.c, 1.5574077246549023);
  t.equals(transformed.d, 4);
  t.equals(transformed.e.toISOString(), '2018-03-26T17:14:51.482Z');
  t.equals(transformed.f, '2018-03-26T17:14:51.482Z');
  t.plan(6);
});

test('README example 1', (t) => {
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
  t.equals(transformed.values[1], 7);
  t.equals(transformed.config.width, 116);
  t.equals(typeof transformed.timestamp, 'number');
  t.ok(transformed.timestamp > 1500000000000);
  t.plan(4);
});

test('README example 2', (t) => {
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
  t.equals(transformed.values[1], 7);
  t.equals(transformed.config.width, 116);
  t.equals(transformed.config.squares[1], 49);
  t.equals(typeof transformed.timestamp, 'object');
  t.ok(transformed.timestamp.toString().length > 22);
  t.plan(5);
});

test('Root Array + external context + altering flat transform args', (t) => {
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
  t.equals(external.value, 3);
  t.equals(external.value2, undefined);
  t.plan(2);
});

test('Simple external context', (t) => {
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
  t.equals(transformed.b, 10);
  t.equals(transformed.c, 14);
  t.plan(2);
});

test('example: eval', (t) => {
  let value = 0; // eslint-disable-line
  const transform = getTransformer({
    transforms: {
      ...exTransforms,
      '%eval%': (arg) => eval(arg), // eslint-disable-line
      '%global%': (arg) => global[arg],
    },
  });
  transform([
    '%eval%',
    `console.log('Testing eval!');
    value = 5;`,
  ]);
  // console.log(transformed);
  t.equals(value, 5);
  //
  //  BELOW VERSION OF THIS TEST CAN'T ALTER VALUE, IS RUN WITH OTHER CONTEXT
  //
  const transformed2 = transform({
    b: [
      '%exec%',
      ['%global%', 'eval'],
      [
        `console.log('Testing eval 2!');
          value = 6;`,
      ],
    ],
  });
  // console.log(transformed2);
  t.equals(value, 5);
  t.equals(transformed2.b, 6);
  t.plan(3);
});

test('example: controlled global', (t) => {
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
        `console.log('Testing eval 2!');
          value = 6;`,
      ],
    ],
    now: ['%exec%', ['%global%', 'Date'], 'now', []],
  });
  // console.log(transformed);
  t.equals(value, 0);
  t.plan(1);
});

test('default root transform', (t) => {
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
  t.same(transformed, [5]);
  const transformed2 = transform({
    if: [{ '<': [['%exec%', ['%global%', 'Date'], 'now', []], 123] }, [5], [6]],
  });
  // console.log(transformed2);
  t.same(transformed2, [6]);
  t.plan(2);
});

test('default level 1 transform', (t) => {
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
  t.equals(transformed.a, 5);
  t.equals(transformed.b, 5);
  t.equals(typeof transformed.c, 'number');
  t.plan(3);
});

test('realistic', (t) => {
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
  t.equals(typeof result, 'object');
  t.equals(result.type, 'temperature');
  t.equals(result.message, 'Temperature is high');
  t.plan(3);
});

test('leaf transform', (t) => {
  const transform = getTransformer({
    leafTransform: (arg) => (typeof arg === 'string' ? arg.toLowerCase() : arg),
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
  t.plan(4);
});

test('leaf transform + default transform', (t) => {
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
  t.equals(transformed.a, 5);
  t.equals(transformed.b, 'test');
  t.equals(transformed.c[0][0], 'tom');
  t.equals(transformed.c[1].KEY, 'value');
  t.plan(4);
});

test('realistic 2', (t) => {
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
  t.equals(result.apiCalls[0][1], '1521667419.16');
  t.equals(result.timeDiff, 2 * 3600 * 1000);
  t.equals(ctx.timeDiff, 2 * 3600 * 1000);
  t.plan(3);
});

test('realistic 2, objectSyntax', (t) => {
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
  t.equals(result.apiCalls[0][1], String(aTimestamp));
  t.equals(result.timeDiff, 3600 * 1000);
  t.plan(2);
});

test('defaultLevel1Transform', (t) => {
  const transform = getTransformer({
    defaultLevel1Transform: jsonLogic.apply,
    rootToContext: false,
  });
  const result = transform({ result: { '>': [{ var: 'msg.pl.0' }, 10] } }, { msg: {} });
  // console.log('RESULT:', result);
  t.ok(!result.result);
  t.plan(1);
});

test('functions in transformed object', (t) => {
  const transform = getTransformer();
  const transformed = transform({
    func: (x) => x * x,
  });
  // console.log(transformed);
  t.equals(transformed.func(5), 25);
  t.plan(1);
});

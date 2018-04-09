import test from 'tape';
import get from 'lodash.get';
import set from 'lodash.set';
import jsonLogic from 'json-logic-js';
import getTransformer, { builtInTransforms } from '../src';

test('func, object, exec & global', t => {
  const transform = getTransformer({
    transforms: {
      ...builtInTransforms,
      '%sin%': Math.sin,
      '%Math%': Math,
      '%global%': arg => global[arg],
    },
  });
  const transformed = transform(
    JSON.parse(
      JSON.stringify({
        v: 2.1201,
        a: ['foo', { x: ['%sin%', [['%get%', 'v']]] }],
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
  t.end();
});

test('Root Array + external context', t => {
  const external = { foo: 'bar' };
  const transform = getTransformer({
    transforms: {
      ...builtInTransforms,
      '%get%': args => get(external, args),
      '%set%': args => {
        set(external, ...args);
        return args[1];
      },
    },
  });
  const transformed = transform([
    ['%set%', ['value', ['%exec%', [['%get%', 'foo'], 'length']]]],
    ['%set%', ['value2', ['%exec%', [['%get%', 'none'], 'length']]]],
  ]);
  // console.log(transformed);
  t.equals(external.value, 3);
  t.equals(external.value2, undefined);
  t.end();
});

test('default context', t => {
  const transform = getTransformer({
    transforms: {
      ...builtInTransforms,
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

test('example: eval', t => {
  let value = 0; // eslint-disable-line
  const transform = getTransformer({
    transforms: {
      ...builtInTransforms,
      '%eval%': args => eval(args[0]), // eslint-disable-line
      '%global%': arg => global[arg],
    },
  });
  const transformed = transform([
    '%eval%',
    [
      `console.log('Testing eval!');
        value = 5;`,
    ],
  ]);
  // console.log(transformed);
  t.equals(value, 5);
  //
  //  BELOW VERSION OF THIS TEST CAN'T ALTER VALUE, IS RUN WITH OTHER CONTEXT
  //
  const transformed2 = transform({
    b: [
      '%exec%',
      [
        ['%global%', 'eval'],
        [
          `console.log('Testing eval 2!');
          value = 6;`,
        ],
      ],
    ],
  });
  // console.log(transformed2);
  t.equals(value, 5);
  t.equals(transformed2.b, 6);
  t.end();
});

test('example: controlled global', t => {
  let value = 0; // eslint-disable-line
  const transform = getTransformer({
    transforms: {
      ...builtInTransforms,
      '%global%': arg => ({ Date, Math }[arg]),
    },
  });
  const transformed = transform({
    b: [
      '%exec%',
      [
        ['%global%', 'eval'],
        [
          `console.log('Testing eval 2!');
          value = 6;`,
        ],
      ],
    ],
    now: ['%exec%', [['%global%', 'Date'], 'now', []]],
  });
  // console.log(transformed);
  t.equals(value, 0);
  t.end();
});

test('default root transform', t => {
  const transform = getTransformer({
    transforms: {
      ...builtInTransforms,
      // '%jl%': (arg, ctx) => jsonLogic.apply(arg, ctx),
      '%global%': arg => ({ Date, Math }[arg]),
    },
    defaultRootTransform: jsonLogic.apply,
  });
  const transformed = transform({
    if: [{ '>': [['%exec%', [['%global%', 'Date'], 'now', []]], 123] }, [5], [6]],
  });
  // console.log(transformed);
  t.same(transformed, [5]);
  const transformed2 = transform({
    if: [{ '<': [['%exec%', [['%global%', 'Date'], 'now', []]], 123] }, [5], [6]],
  });
  // console.log(transformed2);
  t.same(transformed2, [6]);
  t.end();
});

test('default level 1 transform', t => {
  const transform = getTransformer({
    transforms: {
      // ...builtInTransforms,
      '%global%': arg => ({ Date, Math }[arg]),
    },
    defaultLevel1Transform: builtInTransforms['%exec%'],
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
  t.end();
});

test('realistic', t => {
  let result;
  const response = {
    send: msg => {
      result = msg;
    },
  };
  const data = { type: 'temperature', payload: [24.3] };
  // Used in README:
  const transformer = getTransformer({
    defaultLevel1Transform: (arg, ctx) =>
       jsonLogic.apply(arg, ctx),
  });
  let tr = transformer(
    {
      threshold: 22,
      isTemperature: { '===': [{ var: 'data.type' }, 'temperature'] },
      warning: {
        and: [{ var: 'isTemperature' }, { '>': [{ var: 'data.payload.0' }, { var: 'threshold' }] }],
      },
      message: {
        if: [{ var: 'warning' }, 'Temperature is high', undefined],
      },
    },
    { data },
  );
  if (tr.message) {
    response.send({ type: data.type, message: tr.message });
  }
  // console.log(tr);
  t.equals(typeof result, 'object');
  t.equals(result.type, 'temperature');
  t.equals(result.message, 'Temperature is high');
  // Dynamic context:
  result = undefined;
  tr = transformer(
    {
      threshold: 22,
      isTemperature: { '===': [{ var: 'data.type' }, 'temperature'] },
      warning: {
        and: [{ var: 'isTemperature' }, { '>': [{ var: 'data.payload.0' }, { var: 'threshold' }] }],
      },
      message: {
        if: [{ var: 'warning' }, 'Temperature is high', undefined],
      },
    },
    { data: { type: 'temperature', payload: [19.3] } },
  );
  // console.log(tr);
  t.equals(tr.message, undefined);
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
    // transforms: builtInTransforms,
    leafTransform: arg => (typeof arg === 'string' ? arg.toLowerCase() : arg),
    defaultLevel1Transform: builtInTransforms['%exec%'],
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

test('realistic 2', t => {
  const globals = {
    Array,
    Object,
    Date,
    Math,
    JSON,
  };
  const transform = getTransformer({
    transforms: {
      ...builtInTransforms,
      '%global%': arg => globals[arg],
      // '%_%': arg => _[arg],
      '%jl%': jsonLogic.apply,
    },
  });
  // const aTimestamp = 1521663819160 / 1000;
  const context = {
    msg: { pl: [261], ts: '1521667419.16' },
    previous: [{ ts: '1521660219.16', pl: [218] }],
  };
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
    context,
  );
  // console.log(result);
  // console.log(context);
  t.equals(result.apiCalls[0][1], '1521667419.16');
  t.equals(result.timeDiff, 2 * 3600 * 1000);
  t.equals(context.timeDiff, 2 * 3600 * 1000);
  t.end();
});

test('realistic 2, objectSyntax', t => {
  const globals = {
    Array,
    Object,
    Date,
    Math,
    JSON,
  };
  const transform = getTransformer({
    transforms: {
      ...builtInTransforms,
      '%jl%': jsonLogic.apply,
      '%global%': arg => globals[arg],
    },
  });
  const aTimestamp = 1521663819160 / 1000;
  const result = transform(
    {
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
    },
    { msg: { pl: [261], ts: String(aTimestamp), ct: String(aTimestamp - 3600) } },
  );
  // console.log(result);
  t.equals(result.apiCalls[0][1], String(aTimestamp));
  t.equals(result.timeDiff, 3600 * 1000);
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

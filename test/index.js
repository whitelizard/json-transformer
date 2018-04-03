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
  console.log(transformed);
  t.equals(transformed.a[1].x, 0.8528882764707455);
  t.equals(transformed.b, -0.5220934665926794);
  t.equals(transformed.c, 1.5574077246549023);
  t.equals(transformed.d, 4);
  t.equals(transformed.e.toISOString(), '2018-03-26T17:14:51.482Z');
  t.equals(transformed.f, '2018-03-26T17:14:51.482Z');
  t.end();
});

test('objectSyntax: func, object, exec & global', t => {
  const transform = getTransformer({
    transforms: {
      ...builtInTransforms,
      '%sin%': Math.sin,
      '%Math%': Math,
      '%global%': arg => global[arg],
    },
    objectSyntax: true,
  });
  const transformed = transform(
    JSON.parse(
      JSON.stringify({
        v: 2.1201,
        a: ['foo', { x: { '%sin%': [{ '%get%': 'v' }] } }],
        b: { '%exec%': [{ '%global%': 'Math' }, 'cos', [{ '%get%': 'v' }]] },
        c: { '%exec%': [{ '%Math%': null }, 'tan', [1]] },
        d: { '%exec%': ['test', 'length'] },
        e: { '%exec%': ['new', { '%global%': 'Date' }, [1522084491482]] },
        f: { '%exec%': ['new', { '%global%': 'Date' }, [1522084491482], 'toISOString', []] },
      }),
    ),
  );
  console.log(transformed);
  t.equals(transformed.a[1].x, 0.8528882764707455);
  t.equals(transformed.b, -0.5220934665926794);
  t.equals(transformed.c, 1.5574077246549023);
  t.equals(transformed.d, 4);
  t.equals(transformed.e.toISOString(), '2018-03-26T17:14:51.482Z');
  t.equals(transformed.f, '2018-03-26T17:14:51.482Z');
  t.end();
});

test('external context', t => {
  const external = { foo: 'bar' };
  const transform = getTransformer({
    transforms: {
      ...builtInTransforms,
      '%get%': args => get(external, ...args),
      '%set%': args => {
        set(external, ...args);
        return args[1];
      },
    },
  });
  const transformed = transform({
    a: ['%set%', ['value', ['%exec%', [['%get%', ['foo']], 'length']]]],
    b: ['%set%', ['value2', ['%exec%', [['%get%', ['none']], 'length']]]],
  });
  console.log(transformed);
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
    // rootToContext: true,
  });
  const transformed = transform({
    a: 5,
    b: ['%*%', [['%get%', 'a'], 2]],
    c: ['%+%', [['%get%', 'b'], 4]],
  });
  console.log(transformed);
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
    // rootToContext: true,
  });
  const transformed = transform({
    a: [
      '%eval%',
      [
        `console.log('Testing eval!');
        value = 5;`,
      ],
    ],
  });
  console.log(transformed);
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
  console.log(transformed2);
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
    // rootToContext: true,
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
  console.log(transformed);
  t.equals(value, 0);
  t.end();
});

test('default transform', t => {
  const transform = getTransformer({
    transforms: {
      ...builtInTransforms,
      '%global%': arg => ({ Date, Math }[arg]),
    },
    defaultRootTransform: '%exec%',
    // rootToContext: true,
  });
  const transformed = transform({
    a: 5,
    b: [5],
    c: [['%global%', 'Date'], 'now', []],
  });
  console.log(transformed);
  t.equals(transformed.a, 5);
  t.equals(transformed.b, 5);
  t.equals(typeof transformed.c, 'number');
  t.end();
});

test('realistic', t => {
  let result;
  const response = {
    send: msg => {
      console.log('sending:', msg);
      result = msg;
    },
  };
  const data = { type: 'temperature', payload: [24.3] };
  // Used in README:
  getTransformer({
    transforms: {
      '%jl%': args => jsonLogic.apply(args[0]),
      '%send%': args => response.send(args[0]),
    },
    context: { data },
    defaultRootTransform: '%jl%',
  })({
    threshold: 22,
    isTemperature: { '===': [{ var: 'data.type' }, 'temperature'] },
    warning: {
      and: [{ var: 'isTemperature' }, { '>': [{ var: 'data.payload.0' }, { var: 'threshold' }] }],
    },
    result: {
      if: [
        { var: 'warning' },
        ['%send%', [{ type: 'warning', text: 'High temperature' }]],
        undefined,
      ],
    },
  });
  t.equals(typeof result, 'object');
  t.equals(result.type, 'warning');
  t.end();
});

test('default transform', t => {
  const transform = getTransformer({
    leafTransform: arg => (typeof arg === 'string' ? arg.toLowerCase() : arg),
  });
  const transformed = transform({
    a: 5,
    b: 'TEST',
    c: [['Tom', 'Stephen'], { KEY: 'VALUE' }],
  });
  console.log(transformed);
  t.equals(transformed.a, 5);
  t.equals(transformed.b, 'test');
  t.equals(transformed.c[0][0], 'tom');
  t.equals(transformed.c[1].KEY, 'value');
  t.end();
});

import test from 'tape';
import get from 'lodash.get';
import set from 'lodash.set';
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
        a: ['foo', { x: ['%sin%', [1]] }],
        b: ['%exec%', [['%global%', 'Math'], 'cos', [1]]],
        c: ['%exec%', [['%Math%'], 'tan', [1]]],
        d: ['%exec%', ['test', 'length']],
        e: ['%exec%', ['new', ['%global%', 'Date'], [1522084491482]]],
        f: ['%exec%', ['new', ['%global%', 'Date'], [1522084491482], 'toISOString', []]],
      }),
    ),
  );
  t.equals(transformed.a[1].x, 0.8414709848078965);
  t.equals(transformed.b, 0.5403023058681398);
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
  });
  const transformed = transform({
    a: 5,
    b: ['%*%', [['%get%', ['a']], 2]],
    c: ['%+%', [['%get%', ['b']], 4]],
  });
  console.log(transformed);
  t.equals(transformed.b, 10);
  t.equals(transformed.c, 14);
  t.end();
});

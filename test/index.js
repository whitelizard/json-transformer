import test from 'tape';
import getTransformer, { builtInTransforms } from '../src';

test('Date & sin', t => {
  const transform = getTransformer({
    transforms: {
      ...builtInTransforms,
      '%sin%': Math.sin,
      '%Math%': Math,
      '%global%': arg => global[arg],
    },
    context: { foo: 'bar' },
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

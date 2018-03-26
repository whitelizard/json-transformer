import test from 'tape';
import getTransformer from '../src';

test('Date & sin', t => {
  const transform = getTransformer({
    // transformsIn: 'array', // or object, array is default
    transforms: {
      '%sin%': Math.sin,
      '%Math%': Math,
      '%global%': args => {
        if (args[0] === 'new') {
          const Obj = global[args[1]];
          return new Obj(...args[2]);
        }
        const func = global[args[0]];
        if (Array.isArray(args[1])) return func(...args[1]);
        return func;
      },
      // '%-.%': args => args[0][args[1]],
      '%run%': arg => {
        const [obj, ...args] = arg;
        let result = obj;
        for (const value of args) {
          if (Array.isArray(value)) {
            result = result(...value);
          } else {
            result = result[value];
          }
        }
        return result;
      },
    },
  });
  const transformed = transform({
    a: ['b', { c: ['%sin%', [1]] }, ['%global%', ['new', 'Date', [1522084491482]]]],
    d: ['%run%', [['%global%', ['Math']], 'cos', [1]]],
    e: ['%run%', ['test', 'length']],
    f: [
      '%run%',
      [['%global%', ['Number']], [['%run%', [['%Math%'], 'tan', [1]]]], 'toExponential', []],
    ],
  });
  t.equals(transformed.a[1].c, 0.8414709848078965);
  t.equals(transformed.a[2].toISOString(), '2018-03-26T17:14:51.482Z');
  t.equals(transformed.d, 0.5403023058681398);
  t.equals(transformed.e, 4);
  t.equals(transformed.f, '1.5574077246549023');
  t.end();
});

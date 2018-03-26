import test from 'tape';
import getTransformer from '../src';

test('Date & sin', t => {
  const transform = getTransformer({
    // transformsIn: 'array', // or object, array is default
    transforms: {
      '%sin%': Math.sin,
      '%Math%': Math,
      '%global%': arg => {
        // if (args[0] === 'new') {
        //   const Obj = global[args[1]];
        //   return new Obj(...args[2]);
        // }
        const func = global[arg];
        // if (Array.isArray(args[1])) return func(...args[1]);
        return func;
      },
      // '%-.%': args => args[0][args[1]],
      '%exec%': arg => {
        let [obj, member, ...args] = arg;
        let doNew;
        if (obj === 'new') {
          doNew = true;
          [obj, member, ...args] = [member, ...args];
        }
        if (Array.isArray(member)) {
          if (doNew) {
            /* eslint-disable new-cap */
            obj = new obj(...member);
            doNew = false;
            /* eslint-enable new-cap */
          } else obj = obj(...member);
          if (!args.length) return obj;
          [member, ...args] = args;
        }
        if (!args.length) return obj[member];
        for (const value of args) {
          if (Array.isArray(value)) {
            if (doNew) {
              /* eslint-disable new-cap */
              obj = new obj[member](...value);
              doNew = false;
              /* eslint-enable new-cap */
            } else obj = obj[member](...value);
          } else {
            obj = obj[member];
            member = value;
          }
        }
        return obj;
      },
    },
    context: { foo: 'bar' },
  });
  const transformed = transform({
    a: ['foo', { x: ['%sin%', [1]] }],
    b: ['%exec%', [['%global%', 'Math'], 'cos', [1]]],
    c: ['%exec%', [['%Math%'], 'tan', [1]]],
    d: ['%exec%', ['test', 'length']],
    e: ['%exec%', ['new', ['%global%', 'Date'], [1522084491482]]],
    f: ['%exec%', ['new', ['%global%', 'Date'], [1522084491482], 'toISOString', []]],
  });
  t.equals(transformed.a[1].x, 0.8414709848078965);
  t.equals(transformed.b, 0.5403023058681398);
  t.equals(transformed.c, 1.5574077246549023);
  t.equals(transformed.d, 4);
  t.equals(transformed.e.toISOString(), '2018-03-26T17:14:51.482Z');
  t.equals(transformed.f, '2018-03-26T17:14:51.482Z');
  t.end();
});

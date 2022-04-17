# json-transformer-js

Transform an object (e.g parsed from JSON) through dynamic transforms, enabling JSON "rules" that allows controlled code execution.

> Tip: Check out [ploson](https://npmjs.org/package/ploson) if you need something more robust, simpler & more competent. This package is a kind of predecessor to **ploson**.

## Intro

Imaging having this object (nonsense rules, but to show some different examples):

```js
{
  values: ['%data%'],
  config: {
    width: ['%offset%', 100],
  },
  timestamp: ['%ts%'],
}
```

do:

```js
transform(obj);
```

and get:

```js
{
  values:[4, 7, 8, 10, 3, 1],
  config: {
    width: 116,
  },
  timestamp: 1530812733300,
}
```

What made that work was this simple setup (for node.js):

```js
import getTransformer from 'json-transformer-js';

const offset = 16;
const transform = getTransformer({
  transforms: {
    '%offset%': (x) => x + offset,
    '%ts%': Date.now,
    '%data%': [4, 7, 8, 10, 3, 1],
  },
});
```

Lets look at a possibility of handling variables (both preset and dynamic) in an extended example:

```js
import getTransformer from 'json-transformer-js';
import get from 'lodash.get';
import set from 'lodash.set';

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
}); /* -> {
  values: [ 4, 7, 8, 10, 3, 1 ],
  config: {
    width: 116,
    squares: [ 16, 49, 64, 100, 9, 1 ]
  },
  timestamp: 2018-07-05T18:46:42.703Z,
}
*/
```

## Overview

So, this library is simply a depth-first parser of JS objects, making functions of your choice run when encountering certain key strings.

### Options

Most of the features are best described through the different options that can be passed to `getTransformer` (default value after equals):

- `transforms = {}`: The collection of transforms that will be used in the transform.
- `maxDepth = 100`: A limit on the depth of the parsed object, basically to prevent that cyclic references hangs the thread.
- `defaultRootTransform = undefined`: Set a function as an implicit default for the whole parsed data structure.
- `defaultLevel1Transform = undefined`: If transforming an object, each value will be run through this (See example above).
- `leafTransform = undefined`: Set this to a function in order to transform all simple/leaf values. Ex: `arg => (typeof arg === 'string' ? arg.toLowerCase() : arg)` to convert all strings anywhere in the transformed object to lower case.

## Applied

Let's make something more interesting. Let's import [JsonLogic](http://jsonlogic.com), make it the "level 1" default, and make use of context. Let's also assume we have some websocket client that invokes our function `onMessage` when a message arrives, and allows for sending a response.

```js
import getTransformer from 'json-transformer-js';
import jsonLogic from 'json-logic-js';

const rule = {
  threshold: 22,
  isTemperature: { '===': [{ var: 'data.type' }, 'temperature'] },
  warning: {
    and: [{ var: 'isTemperature' }, { '>': [{ var: 'data.payload.0' }, { var: 'threshold' }] }],
  },
  message: {
    if: [{ var: 'warning' }, 'Temperature is high', undefined],
  },
};

function onMessage(data, response) {
  const ctx = { data };
  getTransformer({
    defaultLevel1Transform: (v, k) => {
      const res = jsonLogic.apply(v, ctx);
      set(ctx, k, res);
      return res;
    },
  })(rule);
  if (tr.message) {
    response.send({ type: data.type, message: tr.message });
  }
}
```

The "rule" above should probably be dynamic and e.g. fetched from a database.

## Licence

MIT

## Change Log

### 3

- All context handling removed (including options).
  - (Manual context handling is easy to add in use.)
- Removed builtInTransforms (the `%exec%` transform. You can find it in the test file of the source in github).
- Removed the built in `%get%` transform.
- Much smaller footprint.

### 2

- Removed `objectSyntax` & instead both work always.
- `defaultRootTransform` is now actually for the root / the whole data structure, and
- `defaultLevel1Transform` is the new name for default transform at level 1.
- Both parameters above take functions, not transform references as strings, as before.
- Flat transform arguments possible.

### 1.2

- Added second parameter, `contextInit`, to the returned function, for dynamic context.

### 1.1

- Added the `leafTransform` option/feature.

### 1.0

First official version.

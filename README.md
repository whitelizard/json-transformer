# json-transformer-js

Transform an object (e.g parsed from JSON) through dynamic transforms, enabling JSON "rules" that allows controlled code execution.

## Intro

Imaging having this object (nonsense rules, but to show some different examples):

```js
{
  angle: 2.1201,
  value: ['%exec%', ['%global%', 'Math'], 'cos', [['%get%', 'angle']]],
  timestamp: ['%exec%', ['%global%', 'Date'], 'now', []],
  dateStr: ['%exec%', 'new', ['%global%', 'Date'], [['%get%', 'timestamp']], 'toISOString', []],
  dateStrLen: ['%exec%', ['%get%', 'dateStr'], 'length'],
}
```

do:

```js
transform(json);
```

and get:

```js
{
  angle: 2.1201,
  value: -0.5220934665926794,
  timestamp: 1522084491482,
  dateStr: '2018-03-26T17:14:51.482Z',
  dateStrLen: 24
}
```

What made that work was this simple setup (for node.js):

```js
import getTransformer, { builtInTransforms } from 'json-transformer-js';

const transform = getTransformer({
  transforms: {
    ...builtInTransforms,
    '%global%': arg => global[arg],
  },
});
```

Inside the `builtInTransforms` is the `%exec%` transform (the `%get%` transform is even more built in, see options below).

## Overview

So, this library is simply a depth-first parser of JS objects, making functions of your choice run when encountering certain key strings.

### Options

Most of the features are best described through the different options that can be passed to `getTransformer` (default value after equals):

* `transforms = { '%get%': <modified get from lodash> }`: The collection of transforms that will be used in the transform. (There is also a possibility of passing transforms dynamically when using a transformer).
* `noGetTransform = false`: Makes it possible to remove the built in `%get%`.
* `maxDepth = 100`: A limit on the depth of the parsed object, basically to prevent that cyclic references hangs the thread.
* `context = {}`: A global context, always visible for rules in a created transformer. (`%get%` will grab from this if no dynamic context is given later).
* `rootToContext = true`: Tells the transformer to put the root key-values of the transformed object into the context as parsing is made, enabling `%get%` to fetch these later in the same transformation.
* `defaultRootTransform = undefined`: Set a function as an implicit default for the whole parsed data structure.
* `defaultLevel1Transform = undefined`: More interesting than the previous. For example, if this was set to `builtInTransforms['%exec%']` in the first example above, all the first level arrays with `'%exec%'` could have been removed.
* `leafTransform = undefined`: Set this to a function in order to transform all simple/leaf values. Ex: `arg => (typeof arg === 'string' ? arg.toLowerCase() : arg)` to convert all strings to lower case.

## Applied

Now let's make something more interesting. Let's import [JsonLogic](http://jsonlogic.com), make it the root default, and make use of context. Let's also assume we have some websocket client that invokes our function `onMessage` when a message arrives, and allows for sending a response.

```js
import getTransformer from 'json-transformer-js';
import jsonLogic from 'json-logic-js';

const transform = getTransformer({
  defaultLevel1Transform: jsonLogic.apply,
});

function onMessage(data, response) {
  transform(
    {
      threshold: 22,
      isTemperature: { '===': [{ var: 'data.type' }, 'temperature'] }, // See context below
      warning: {
        and: [{ var: 'isTemperature' }, { '>': [{ var: 'data.payload.0' }, { var: 'threshold' }] }],
      },
      message: {
        if: [{ var: 'warning' }, 'Temperature is high', undefined],
      },
    },
    { data }, // Context
  );
  if (tr.message) {
    response.send({ type: data.type, message: tr.message });
  }
}
```

The "rule" above should of course be dynamic and e.g. fetched from a database.

## Licence

MIT

## Change Log

### 2

* Removed `objectSyntax` & instead both work always.
* `defaultRootTransform` is now actually for the root / the whole data structure, and
* `defaultLevel1Transform` is the new name for default transform at level 1.
* Both parameters above take functions, not transform references as strings, as before.
* Flat transform arguments possible.

### 1.2

* Added second parameter, `contextInit`, to the returned function, for dynamic context.

### 1.1

* Added the `leafTransform` option/feature.

### 1.0

First official version.

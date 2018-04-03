# json-transformer

Transform an object (e.g parsed from JSON) through dynamic transforms, enabling JSON "rules" that allows controlled code execution.

## Intro

Imaging having this object (nonsense rules, but to show some different examples):

```js
{
  angle: 2.1201,
  value: ['%exec%', [['%global%', 'Math'], 'cos', [['%get%', 'angle']]]],
  timestamp: ['%exec%', ['%global%', 'Date'], 'now', []],
  dateStr: ['%exec%', ['new', ['%global%', 'Date'], ['%get%', 'timestamp'], 'toISOString', []]],
  dateStrLen: ['%exec%', [['%get%', 'dateStr'], 'length']]
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

What made that work was this simple setup (for node.js, also using the "..." operator):

```js
import getTransformer, { builtInTransforms } from 'json-transformer';

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

* `transforms = { '%get%': <modified get from lodash> }`: The collection of transforms that will be used in the transform.
* `noGetTransform = false`: Makes it possible to remove the built in `%get%`.
* `maxDepth = 100`: A limit on the depth of the parsed object, basically to prevent that cyclic references hangs the thread.
* `objectSyntax = false`: Changes the syntax from `[func, [args]]` to `{func: [args]}`.
* `context = {}`: This is the context that `%get%` will grab from.
* `rootToContext = true`: Tells the transformer to put the root key-values of the transformed object into the context.
* `defaultRootTransform = undefined`: Makes one of the transforms the implicit default at the root of the parsed object.

## Applied

Now let's make something more interesting. Let's import [JsonLogic](http://jsonlogic.com), make it the root default, and make use of context. Let's also assume we have some websocket client that invokes our function `onMessage` when a message arrives, and allows for sending a response.

```js
import getTransformer from 'json-transformer';
import jsonLogic from 'json-logic-js';

function onMessage(data, response) {
  getTransformer({
    transforms: {
      '%jl%': args => jsonLogic(args[0]),
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
}
```

The "rule" above should of course be dynamic and e.g. fetched from a database.

## Licence

MIT

## Change Log

### 1.0

First official version.

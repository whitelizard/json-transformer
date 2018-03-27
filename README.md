# json-transformer

Transform an object (that was parsed from JSON) through dynamic transforms.

Imaging having this JSON (e.g from some noSQL database and/or sent over the network):

```json
{
  "timestamp": ["%exec%", ["%global%", "Date"], "now", []],
  "dateStr": ["%exec%", ["new", ["%global%", "Date"], ["%get%", ["timestamp"]], "toISOString", []]],
  "dateStrLen": ["%exec%", [["%get%", ["dateStr"]], "length"]]
}
```

do:

```js
transform(json);
```

and get:

```js
{
  timestamp: 1522084491482,
  dateStr: '2018-03-26T17:14:51.482Z',
  dateStrLen: 24
}
```

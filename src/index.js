import isObject from 'lodash.isobject';
import isFunction from 'lodash.isfunction';
import get from 'lodash.get';

/*
exampleConf: {
  objectSyntax: true,
  transforms: {
    '%tag%': (args) => { ... }
  },
  context: {},
}
 */

const context = {};

export const builtInTransforms = {
  // '%global%': arg => (global || window)[arg],
  '%get%': args => get(context, ...args),
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
    if (!args.length) return !obj || !member ? obj : obj[member];
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
};
const defaultConf = {
  // objectSyntax: false,
  // rootToContext: false,
  context,
  maxDepth: 100,
};

function transformer(conf, obj, level = 0) {
  if (level > conf.maxDepth) return obj;
  if (Array.isArray(obj)) {
    const newArray = obj.map(v => transformer(conf, v, level + 1));
    if (!conf.objectSyntax && newArray[0] in conf.transforms) {
      const value = conf.transforms[newArray[0]];
      return isFunction(value) ? value(newArray[1]) : value;
    }
    return newArray;
  } else if (isObject(obj)) {
    const newObj = {};
    Object.entries(obj).forEach(([k, v]) => {
      newObj[k] = transformer(conf, v, level + 1);
      if (!level && conf.rootToContext) conf.context[k] = newObj[k];
    });
    const key = Object.keys(newObj)[0];
    if (conf.objectSyntax && key in conf.transforms) {
      return conf.transforms[key](newObj[key]);
    }
    return newObj;
  }
  return obj;
}

export default function getTransformer(config) {
  return transformer.bind(this, { ...defaultConf, ...config });
}

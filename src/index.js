import isObject from 'lodash.isobject';
import isFunction from 'lodash.isfunction';

/*
exampleConf: {
  objectSyntax: true,
  transforms: {
    '%tag%': (args) => { ... }
  },
  context: {},
}
 */
export const builtInTransforms = {
  '%global%': args => {
    if (args[0] === 'new') {
      const Obj = global[args[1]];
      return new Obj(...args[2]);
    }
    const func = global[args[0]];
    return func(...args[1]);
  },
};
const defaultConf = {
  // objectSyntax: false,
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

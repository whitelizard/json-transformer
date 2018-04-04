import isObject from 'lodash.isobject';
import isFunction from 'lodash.isfunction';
import get from 'lodash.get';

// const context = {};

const defaultConf = {
  // objectSyntax: false,
  rootToContext: true,
  // noGetTransform: false,
  // defaultRootTransform: undefined,
  // leafTransform: undefined,
  // context,
  maxDepth: 100,
  // transforms: {
  //   // '%tag%': (args) => { ... }
  // },
};

export const builtInTransforms = {
  // '%global%': arg => (global || window)[arg],
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
      } else if (typeof obj === 'function') {
        obj = obj(...member);
      }
      if (!args.length) return obj;
      [member, ...args] = args;
    }
    if (!args.length) return !obj || !member ? obj : obj[member];
    for (const value of args) {
      if (Array.isArray(value) && typeof obj[member] === 'function') {
        if (doNew) {
          /* eslint-disable new-cap */
          obj = new obj[member](...value);
          doNew = false;
          /* eslint-enable new-cap */
        } else {
          obj = obj[member](...value);
        }
      } else {
        obj = obj[member];
        member = value;
      }
    }
    return obj;
  },
};

function transformer(conf, obj, contextInit, level = 0) {
  if (contextInit) conf.context = { ...conf.context, ...contextInit };
  if (level > conf.maxDepth) return obj;
  if (Array.isArray(obj)) {
    const newArray = obj.map(v => transformer(conf, v, undefined, level + 1));
    if (!conf.objectSyntax) {
      // console.log(level, obj);
      if (conf.defaultRootTransform && level === 1) {
        const f = conf.transforms[conf.defaultRootTransform];
        return isFunction(f) ? f(newArray, conf.context) : f;
      }
      if (newArray[0] in conf.transforms) {
        const f = conf.transforms[newArray[0]];
        return isFunction(f) ? f(newArray[1], conf.context) : f;
      }
    }
    return newArray;
  } else if (isObject(obj)) {
    const newObj = {};
    Object.entries(obj).forEach(([k, v]) => {
      newObj[k] = transformer(conf, v, undefined, level + 1);
      if (!level && conf.rootToContext) conf.context[k] = newObj[k];
    });
    const key = Object.keys(newObj)[0];
    if (conf.objectSyntax && key in conf.transforms) {
      const f = conf.transforms[key];
      return isFunction(f) ? f(newObj[key], conf.context) : f;
    }
    return newObj;
  }
  return conf.leafTransform ? conf.leafTransform(obj) : obj;
}

function theGetTransform(args, ctx) {
  if (typeof args === 'string') return get(ctx, args);
  return get(ctx, ...args);
}

export default function getTransformer(config) {
  const conf = { context: {}, transforms: {}, ...defaultConf, ...config };
  if (!conf.transforms['%get%'] && !conf.noGetTransform) {
    conf.transforms['%get%'] = theGetTransform;
  }
  return transformer.bind(this, conf);
}

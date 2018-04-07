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
    // console.log('%exec%:', arg);
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

function transformer(conf, obj, context, transforms, level = 0) {
  const ctx = context || conf.context;
  if (level > conf.maxDepth) return obj;
  // console.log(
  //   level,
  //   Array(level)
  //     .fill('  ')
  //     .join(''),
  //   obj,
  // );
  if (Array.isArray(obj)) {
    const newArray = obj.map(v => transformer(conf, v, ctx, transforms, level + 1));
    if (!conf.objectSyntax) {
      if (conf.defaultRootTransform && level === 1) {
        const f =
          (transforms && transforms[conf.defaultRootTransform]) ||
          conf.transforms[conf.defaultRootTransform];
        return isFunction(f) ? f(newArray, ctx) : f;
      }
      if (newArray[0] in conf.transforms || newArray[0] in (transforms || {})) {
        const f = (transforms && [newArray[0]]) || conf.transforms[newArray[0]];
        return isFunction(f) ? f(newArray[1], ctx) : f;
      }
    }
    return newArray;
  } else if (isObject(obj)) {
    const newObj = {};
    Object.entries(obj).forEach(([k, v]) => {
      newObj[k] = transformer(conf, v, ctx, transforms, level + 1);
      if (!level && conf.rootToContext) ctx[k] = newObj[k];
    });
    const key = Object.keys(newObj)[0];
    // console.log(level, key, newObj);
    if (conf.defaultRootTransform && level === 1) {
      const f =
        (transforms && transforms[conf.defaultRootTransform]) ||
        conf.transforms[conf.defaultRootTransform];
      return isFunction(f) ? f(newObj, ctx) : f;
    }
    if (conf.objectSyntax) {
      if (key in conf.transforms || key in (transforms || {})) {
        const f = (transforms && transforms[key]) || conf.transforms[key];
        return isFunction(f) ? f(newObj[key], ctx) : f;
      }
    }
    return newObj;
  }
  return conf.leafTransform ? conf.leafTransform(obj) : obj;
}

function theGetTransform(args, ctx) {
  if (typeof args === 'string') return get(ctx, args);
  return get(ctx, args);
}

export default function getTransformer(config) {
  const conf = { context: {}, transforms: {}, ...defaultConf, ...config };
  if (!conf.transforms['%get%'] && !conf.noGetTransform) {
    conf.transforms['%get%'] = theGetTransform;
  }
  return transformer.bind(this, conf);
}

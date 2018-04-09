import isObject from 'lodash.isobject';
import isFunction from 'lodash.isfunction';
import get from 'lodash.get';
import tail from 'lodash.tail';

// const context = {};

const defaultConf = {
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
    if (!Array.isArray(arg)) return arg;
    if (arg.length === 1) return arg[0];
    let [obj, member, ...args] = arg;
    let doNew;
    if (obj === 'new') {
      doNew = true;
      [obj, member, ...args] = [member, ...args];
    }
    if (Array.isArray(member)) {
      if (isFunction(obj)) {
        if (doNew) {
          /* eslint-disable new-cap */
          obj = new obj(...member);
          /* eslint-enable new-cap */
          doNew = false;
        } else {
          obj = obj(...member);
        }
      }
      [member, ...args] = args;
    }
    // console.log('%exec% MID:', obj, member, args);
    if (!args.length) {
      /* eslint-disable no-nested-ternary */
      return !obj ? obj : !member ? obj : obj[member] ? obj[member] : arg;
      /* eslint-enable no-nested-ternary */
    }
    for (const value of args) {
      if (Array.isArray(value) && isFunction(obj[member])) {
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

function funcInObj(key, obj, args, ctx, defaultReturn) {
  if (key in obj) {
    // console.log('funcInObj:', key, 'ARGS:', args, 'CTX:', ctx, 'DEF:', defaultReturn);
    const func = obj[key];
    // console.log('funcInObj func:', typeof func, func, isFunction(func) && func(args, ctx));
    return isFunction(func) ? func(args, ctx) : func;
  }
  return defaultReturn;
}

function transform(conf, obj, ctx, trs, level = 0) {
  // console.log(level, 'transform:', obj, '::', ctx);
  if (level > conf.maxDepth) return obj;
  // console.log(
  //   level,
  //   Array(level)
  //     .fill('  ')
  //     .join(''),
  //   obj,
  // );
  if (Array.isArray(obj)) {
    const newArray = obj.map(v => transform(conf, v, ctx, trs, level + 1));
    // console.log(level, 'newArray:', newArray);
    const args = newArray.length > 2 && !Array.isArray(newArray[1]) ? tail(newArray) : newArray[1];
    return funcInObj(newArray[0], trs, args, ctx, newArray);
  } else if (isObject(obj)) {
    const newObj = Object.entries(obj).reduce((r, [k, v]) => {
      // console.log(level, 'OBJ loop:', k, ':', v, ' CTX:', ctx);
      r[k] = transform(conf, v, ctx, trs, level + 1);
      if (level === 0 && conf.defaultLevel1Transform) {
        r[k] = conf.defaultLevel1Transform(r[k], ctx);
      }
      if (!level && conf.rootToContext) ctx[k] = r[k];
      return r;
    }, {});
    const key = Object.keys(newObj)[0];
    return funcInObj(key, trs, newObj[key], ctx, newObj);
  }
  return conf.leafTransform ? conf.leafTransform(obj) : obj;
}

function transformer(conf, obj, context, transforms) {
  const ctx = context || conf.context;
  let result = transform(
    conf,
    obj,
    ctx,
    transforms ? { ...conf.transforms, ...transforms } : conf.transforms,
  );
  if (conf.defaultRootTransform) {
    result = conf.defaultRootTransform(result, ctx);
  }
  return result;
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

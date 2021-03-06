import isPlainObject from 'lodash.isplainobject';
import isFunction from 'lodash.isfunction';
import tail from 'lodash.tail';

const defaultConf = {
  // defaultRootTransform: undefined,
  // leafTransform: undefined,
  maxDepth: 100,
  // transforms: {
  //   // '%tag%': (args) => { ... }
  // },
};

function funcInObj(key, obj, args, defaultReturn) {
  if (key in obj) {
    // console.log('funcInObj:', key, 'ARGS:', args, 'CTX:', 'DEF:', defaultReturn);
    const func = obj[key];
    // console.log('funcInObj func:', typeof func, func, isFunction(func) && func(args));
    return isFunction(func) ? func(args) : func;
  }
  return defaultReturn;
}

function transform(conf, obj, trs, level = 0) {
  if (level > conf.maxDepth) return obj;
  if (Array.isArray(obj)) {
    const newArray = obj.map((v) => transform(conf, v, trs, level + 1));
    const args = newArray.length > 2 && !Array.isArray(newArray[1]) ? tail(newArray) : newArray[1];
    return funcInObj(newArray[0], trs, args, newArray);
  }
  if (isPlainObject(obj)) {
    const newObj = Object.entries(obj).reduce((r, [k, v]) => {
      /* eslint-disable no-param-reassign */
      r[k] = transform(conf, v, trs, level + 1);
      if (level === 0 && conf.defaultLevel1Transform) {
        r[k] = conf.defaultLevel1Transform(r[k], k);
      }
      /* eslint-enable no-param-reassign */
      return r;
    }, {});
    const key = Object.keys(newObj)[0];
    return funcInObj(key, trs, newObj[key], newObj);
  }
  return conf.leafTransform ? conf.leafTransform(obj) : obj;
}

const transformer = (conf) => (obj, transforms) => {
  let result = transform(
    conf,
    obj,
    transforms ? { ...conf.transforms, ...transforms } : conf.transforms,
  );
  if (conf.defaultRootTransform) {
    result = conf.defaultRootTransform(result);
  }
  return result;
};

export default function getTransformer(config) {
  return transformer({
    transforms: {},
    ...defaultConf,
    ...config,
  });
}

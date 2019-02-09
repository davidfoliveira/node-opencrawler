exports.now = () => (new Date()).getTime();

exports.relativeTime = (amount, unit) => {
  let multiplier;
  if (amount.match(/([dhmsM])$/)) {
    unit = RegExp.$1;
    amount = parseInt(amount, 10);
  }
  if (unit === 'ms' || unit === 'M') {
    multiplier = 1;
  } else if (unit === 'seconds' || unit === 'second' || unit === 'sec' || unit === 's') {
    multiplier = 1000;
  } else if (unit === 'minutes' || unit === 'minute' || unit === 'min' || unit === 'm') {
    multiplier = 60 * 1000;
  } else if (unit === 'hours' || unit === 'hour' || unit === 'h') {
    multiplier = 60 * 60 * 1000;
  } else if (unit === 'days' || unit === 'day' || unit === 'd') {
    multiplier = 60 * 60 * 1000;
  } else {
    throw Error(`Unknown time unit ${unit}`);
  }
  return amount * multiplier;
};

// eslint-disable-next-line max-len, no-confusing-arrow
exports.promisify = func => new Promise((fulfill, reject) => func((error, ...args) => error ? reject(error) : fulfill.call(error, ...args)));

// For each value in an array, call a function which returns a promise.
// Waits for promises, keeping a certain (or not) number of concurrent promises
exports.eachPromise = (array, fn, concurrents) => {

  // No number of concurrent promises? Just run them all!
  if (!concurrents) {
    return Promise.all(array.map((item) => fn(item)));
  }

  // Shall we keep a certain number of concurrent promises?
  return new Promise((fulfill, reject) => {
    const
      promises = [],
      outputs = [];
    let
      nextPromise = 0,
      finishedPromises = 0;
    const
      runNextPromise = () => {
        const curPromise = nextPromise++;
        promises[curPromise] = fn(array[curPromise]);
        promises[curPromise].then((res) => {
          finishedPromises++;
          outputs[curPromise] = res;
          if (finishedPromises == array.length) {
            return fulfill(outputs);
          }
          if (nextPromise < array.length) {
            return runNextPromise();
          }
        });
      };

    // Run the maximum number of promises we can
    for(let x = 0; x < concurrents && x < array.length; x++) {
      runNextPromise();
    }
  });

};

exports.PromiseAllObject = (obj) => {
  const
    idxToKey = {},
    promises = [],
    output = {};
  let
    idx = -1;

  // Index everything
  Object.keys(obj).forEach((key) => {
    idxToKey[idx++] = key;
    promises.push(obj[key]);
  });

  // Wait for all promises
  return Promise.all(promises).then((values) => {
    // Reindex again
    idx = -1;
    values.forEach((value) => {
      output[idxToKey[idx++]] = value;
    });
    return output;
  });
};

exports.promiseWait = time => new Promise((fulfill) => {
  setTimeout(() => fulfill(), time);
});


// Create an instance of a class and call .start() on it with a specific config object
exports.createAndStart = (Class, config) => {
  const instance = new Class(config);
  return instance.start().then(() => instance);
};
exports.createModuleStarter = exports.createAndStart;

// Make config support default values and getMutable()
exports.mutableConfig = (config) => {
  const proto = config.constructor.prototype;
  if (proto.getMutable) {
    return config;
  }

  config._get = config.get;
  // eslint-disable-next-line func-names
  config.get = function (key, defaultValue) {
    try {
      return this._get(key);
    } catch (ex) {
      if (typeof defaultValue !== 'undefined') {
        return defaultValue;
      }
      throw ex;
    }
  };
  config.getMutable = proto.get;

  // Ensure next objects have the same functions
  proto._get = config._get;
  proto.get = config.get;
  proto.getMutable = config.get;

  return config;
};

// Return an array of unique items from another array
exports.unique = (list) => {
  const keys = {};
  list.forEach((key) => {
    keys[key] = true;
  });
  return Object.keys(keys);
};

exports.now = () => (new Date()).getTime();

exports.relativeTime = (amount, unit) => {
  let multiplier;
  if (amount.match(/([dhmsM])$/)) {
    unit = RegExp.$1;
    amount = parseInt(amount, 10);
  }
  if (unit == 'ms' || unit == 'M') {
    multiplier = 1;
  }
  else if (unit == 'seconds' || unit == 'second' || unit == 'sec' || unit == 's') {
    multiplier = 1000;
  }
  else if (unit == 'minutes' || unit == 'minute' || unit == 'min' || unit == 'm') {
    multiplier = 60 * 1000;
  }
  else if (unit == 'hours' || unit == 'hour' || unit == 'h') {
    multiplier = 60 * 60 * 1000;
  }
  else if (unit == 'days' || unit == 'day' || unit == 'd') {
    multiplier = 60 * 60 * 1000;
  }
  else {
    throw Error(`Unknown time unit ${unit}`);
  }
  return amount * multiplier;
}

exports.promisify = (func) => {
  return new Promise((fulfill, reject) => func((error, ...args) => error ? reject(error) : fulfill.call(error, ...args)));
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

exports.promiseWait = (time) => {
  return new Promise((fulfill, reject) => {
    setTimeout(() => fulfill(), time);
  });
};

exports.createAndStart = (Class, config) => {
  const instance = new Class(config);
  return instance.start().then(() => {
    return instance;
  });
};

exports.createModuleStarter = exports.createAndStart;
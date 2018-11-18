const
  util = require('./lib/util');

exports.start = (config) => util.createAndStart(require('./lib/crawler').Crawler, config);
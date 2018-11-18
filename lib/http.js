const
  util    = require('./util'),
  request = require('request-lite');


// Perform an HTTP GET
exports.get = async url => {
  const opts = {
    uri:      url,
    method:   "GET",
    headers:  this.DEFAULT_HEADERS
  };
  return util.promisify((callback) => request(opts, callback));
};

exports.USER_AGENT = 'OpenCrawler/0.1';
exports.DEFAULT_HEADERS = {
  'User-Agent': exports.USER_AGENT
};
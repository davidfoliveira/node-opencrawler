const
  http    = require('http'),
  request = require('request-lite'),
  util    = require('./util');


// Perform an HTTP GET
exports.get = async (url, headers, opts) => {
  const requestOpts = {
    uri:      url,
    method:   'GET',
    headers:  Object.assign({}, this.DEFAULT_HEADERS, headers),
  };
  if (opts.maxSockets !== null) {
    request.maxSockets = opts.maxSockets;
  }

  return util.promisify(callback => request(requestOpts, callback));
};

exports.statusCodeDescription = (code) => http.STATUS_CODES[code];

exports.DEFAULT_HEADERS = {
};

const
  request = require('request-lite'),
  util    = require('./util');


// Perform an HTTP GET
exports.get = async (url, headers) => {
  const opts = {
    uri:      url,
    method:   'GET',
    headers:  Object.assign({}, this.DEFAULT_HEADERS, headers),
  };
  return util.promisify(callback => request(opts, callback));
};

exports.DEFAULT_HEADERS = {
};

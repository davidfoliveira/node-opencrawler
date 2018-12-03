const
  url     = require('url'),

  http    = require('./http'),
  robots  = require('./robots'),
  util    = require('./util');


exports.fetchItem = async (item) => {
  // Parse the URL as it can be useful later on
  const urlObj = url.parse(item.URL);

  // Get the item content
  const res = await http.get(item.URL);

  // Error ?
  if (res.statusCode !== 200) {
    return {
      Status:     res.statusCode,
      LastVisit:  util.now(),
    };
  }

  // Is it the robots file
  if (urlObj.path === '/robots.txt' && res.headers['content-type'] === 'text/plain') {
    const content = robots.parse(res.body, res.headers);
    return {
      Status: res.statusCode,
      Links: [
        '/',
      ],
    };
  }

  return 99;
};

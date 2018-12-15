const
  url        = require('url'),
  htmlparser = require('htmlparser'),
  zcsel      = require('zcsel'),
  http       = require('./http'),
  robots     = require('./robots'),
  util       = require('./util');


exports.fetchItem = async (item, opts) => {
  // Parse the URL as it can be useful later on
  const urlObj = url.parse(item.URL);

  // Get the item content
  console.log(`Fetching ${item.URL}`);
  const res = await http.get(item.URL, { 'User-Agent': opts.userAgent });

  // Error ?
  if (res.statusCode !== 200) {
    return {
      Status:     res.statusCode,
      LastVisit:  util.now(),
    };
  }

  // Is it the robots file
  if (urlObj.path === '/robots.txt' && res.headers['content-type'] === 'text/plain') {
    const
      content    = robots.parse(res.body),
      agentRules = robots.userAgentRules(content, opts.userAgent);

    return {
      URL:     item.URL,
      Domain:  urlObj.hostname,
      Status:  res.statusCode,
      Type:    'robots',
      Content: agentRules,
      Links:   robots.isURLAllowed(agentRules, '/') ? ['/'] : [],
    };
  }
  if (res.headers['content-type'] && res.headers['content-type'].toString().toLowerCase().startsWith('text/html')) {
    const result = {
      URL: item.URL,
      Domain: urlObj.hostname,
    };
    try {
      await this.getHTMLPageResult(result, res);
    } catch (ex) {
      console.error('Error parsing HTML: ', ex);
      return null;
    }
    return result;
  }

  console.warn("Don't know how to parse this page: ", item.URL);
  return 99;
};

exports.getHTMLPageResult = (result, res) => new Promise((fulfill, reject) => {
  const pHandler = new htmlparser.DefaultHandler((err, dom) => {
    if (err) {
      reject(new Error(`Error parsing HTML ${err}`));
    }

    // Initialize the DOM structure
    const $ = zcsel.initDom(dom);

    // Get all the links
    const links = {};
    $('a').each((linkEl) => {
      const
        addr = url.resolve(result.URL, linkEl.attr('href').trim()),
        addrObj = url.parse(addr);
      if (addrObj.hostname !== result.Domain) {
        return;
      }
      links[addrObj.path] = true;
    });
    result.Links = Object.keys(links);

    return fulfill(result);
  });
  const parser = new htmlparser.Parser(pHandler);
  parser.parseComplete(res.body);
});

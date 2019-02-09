const
  url        = require('url'),
  htmlparser = require('htmlparser'),
  zcsel      = require('zcsel'),
  http       = require('./http'),
  robots     = require('./robots'),
  util       = require('./util');


exports.fetchItem = async (item, opts) => {
  // Parse the URL as it can be useful later on
  const
    urlObj = url.parse(item.URL),
    finishInt = setInterval(() => {
      console.log("Still working on "+item.URL);
    }, 30000);

  let
    res;

  // Get the item content
  console.log(`Fetching ${item.URL}`);

  try {
    res = await http.get(item.URL, { 'User-Agent': opts.userAgent }, { maxSockets: 65000 });
  }
  catch(err) {
    console.info(`Error requesting ${item.URL}: ${err}`);
    clearInterval(finishInt);
    return {
      Error:      {
        Details:      {
          Code:         err.code,
          Description:  err.toString(),
        },
      },
    };
  }

  // Error ?
  if (res.statusCode !== 200) {
    console.info(`Bad status code from ${item.URL}: ${res.statusCode}`);
    clearInterval(finishInt);
    return {
      Error: {
        Status:     res.statusCode
      },
    };
  }

  // Is it the robots file
  if (urlObj.path === '/robots.txt' && res.headers['content-type'] === 'text/plain') {
    const
      content    = robots.parse(res.body),
      agentRules = robots.userAgentRules(content, opts.userAgent);

    clearInterval(finishInt);
    return {
      Status:  res.statusCode,
      Type:    'robots',
      Content: agentRules,
      Links:   robots.isURLAllowed(agentRules, '/') ? ['/'] : [],
    };
  }
  if (res.headers['content-type'] && res.headers['content-type'].toString().toLowerCase().startsWith('text/html')) {
    const result = { };
    try {
      await this.getHTMLPageResult(item, result, res);
    } catch (ex) {
      console.error('Error parsing HTML: ', ex);
      clearInterval(finishInt);
      return null;
    }
    clearInterval(finishInt);
    return result;
  }

  console.warn("Don't know how to parse this page: ", item.URL);
  clearInterval(finishInt);
  return 99;
};

exports.getHTMLPageResult = (item, result, res) => new Promise((fulfill, reject) => {
  console.log("Parsing "+item.URL);
  const pHandler = new htmlparser.DefaultHandler((err, dom) => {
    if (err) {
      return reject(new Error(`Error parsing HTML ${err}`));
    }

    // Initialize the DOM structure
    const $ = zcsel.initDom(dom);

    // Get all the links
    const links = {};
    $('a').each((linkEl) => {
      const
        linkedURI = linkEl.attr('href').trim();
      let
        URLObject;

      if (!linkedURI || linkedURI.match(/\t/)) {
        return;
      }
      try {
        URLObject = url.parse(url.resolve(result.URL, linkedURI));
      }
      catch(ex) {
        return;
      }
      // TODO: we might want to accept requests outside of this domain
      if (!URLObject.protocol.match(/^https?:$/i) || URLObject.hostname !== result.Domain || URLObject.path === item.URL) {
        return;
      }
      links[URLObject.path] = true;
    });
    result.Links = Object.keys(links);
    return fulfill(result);
  });
  const parser = new htmlparser.Parser(pHandler);
  parser.parseComplete(res.body);
});

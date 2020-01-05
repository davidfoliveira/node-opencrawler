const
  url        = require('url'),
  htmlparser = require('htmlparser'),
  zcsel      = require('zcsel'),
  http       = require('./http'),
  robots     = require('./robots'),
  util       = require('./util');


exports.fetchItem = async (item, scraper, opts) => {
  // Parse the URL as it can be useful later on
  const
    urlObj = url.parse(item.URL),
    finishInt = setInterval(() => {
      console.log("Still working on "+item.URL);
    }, 30000);

  let
    parser,
    response,
    result;

  // Get the item content
  console.log(`Fetching ${item.URL}`);
  try {
    response = await http.get(item.URL, { 'User-Agent': opts.userAgent }, { maxSockets: 65000, timeout: 60000 });
  }
  catch(err) {
    console.info(`Error requesting ${item.URL}: ${err}`);
    clearInterval(finishInt);
    return {
      Error:      {
        Details:      {
          Type:         'internal',
          Code:         err.code,
          Description:  err.toString(),
        },
      },
    };
  }

  // Error ?
  if (response.statusCode !== 200) {
    console.info(`Bad status code from ${item.URL}: ${response.statusCode}`);
    clearInterval(finishInt);
    return {
      Error: {
        Type:         'external',
        Code:         response.statusCode,
        Description:  http.statusCodeDescription(response.statusCode),
      },
    };
  }

  // Is it a robots file
  if (urlObj.path === '/robots.txt' && response.headers['content-type'] === 'text/plain') {
    parser = this.getRobotsResult;
  }
  // It's an HTML page
  else if (response.headers['content-type'] && response.headers['content-type'].toString().toLowerCase().startsWith('text/html')) {
    parser = this.getHTMLPageResult;
  }
  else {
    console.warn("Don't know how to parse this page: ", item.URL);
    clearInterval(finishInt);
    return 99;
  }

  // Parse it
  try {
    result = await parser.call(this, item, response, scraper, opts);
  } catch (err) {
    console.error(`Error parsing result of ${item.URL}: `, err);
    result = {
      Error: {
        Details: {
          Type:         'internal',
          Code:         err.code,
          Description:  err.toString(),
        },
      },
    };
  }

  clearInterval(finishInt);
  return result;
};

exports.getRobotsResult = async (item, res, scraper, opts) => {
    const
      content    = robots.parse(res.body),
      agentRules = robots.userAgentRules(content, opts.userAgent);

    return {
      Status:  res.statusCode,
      Type:    'robots',
      Content: agentRules,
      Links:   robots.isURLAllowed(agentRules, '/') ? ['/'] : [],
    };
};

exports.getHTMLPageResult = (item, res, scraper, opts) => new Promise((fulfill, reject) => {
  const result = {};
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
        URLObject = url.parse(url.resolve(item.URL, linkedURI));
      }
      catch(ex) {
        return;
      }
      // TODO: we might want to accept requests outside of this domain
      if (!URLObject.protocol.match(/^https?:$/i) || URLObject.hostname !== item.Domain || URLObject.path === item.URL) {
        return;
      }
      links[URLObject.path] = true;
    });
    result.Links = Object.keys(links);

    // Scrape
    if (scraper && !result.Error) {
      try {
        result.Content = scraper.call(this, $, res, item, opts);
      } catch (err) {
        console.error(`Error scraping result of ${item.URL}: `, err);
        result.Error = {
          Type:         'scraper',
          Code:         err.code,
          Description:  err.toString(),
        };
      }
    }

    return fulfill(result);
  });
  const parser = new htmlparser.Parser(pHandler);
  parser.parseComplete(res.body);
});

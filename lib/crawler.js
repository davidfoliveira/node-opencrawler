const
  modules         = require('../modules'),
  util            = require('./util'),
  ModularHandlers = require('./modular_handlers'),

  HANDLER_TYPES = {
    retrieveItems:  'storage',
    storeItems:     'storage',
    getConfig:      'storage',
    setConfig:      'storage',
    canFetchItems:  'concurrency',
    fetchItems:     'fetch',
    storeContents:  'storage',
  },
  DEFAULT_HANDLERS = {
    retrieveItems:  'sqlite3',
    storeItems:     'sqlite3',
    getConfig:      'sqlite3',
    setConfig:      'sqlite3',
    canFetchItems:  'memory',
    fetchItems:     'local',
    storeContents:  'sqlite3',
  };


class Crawler extends ModularHandlers {
  constructor(originalConfig) {
    const config = util.mutableConfig(originalConfig);

    // Call ModularHandlers constructor
    super(modules, HANDLER_TYPES, DEFAULT_HANDLERS, config);

    // Load configuration values and make them update in case the configuration changes
    this._loadConfig(config);
    if (config.on) {
      console.info('Updating configuration...');
      config.on('change', this._loadConfig);
    }
  }

  _loadConfig(config) {
    this._loopInterval     = config.get('loopInterval', 5000);
    this._concurrentCycles = config.get('concurrentCycles', null);
    this._cycleItems       = config.get('cycleItems', 100);
    this._followDomains    = config.get('followDomains', []);
    this._userAgent        = config.get('userAgent', 'OpenCrawler/0.1');
    this._domainCycles     = config.get('domainCycles', false);
    this._urlReplace       = config.get('urlReplace', (url) => url.replace(/#.*$/, ''));
    this._nextVisit        = config.get('nextVisit', this.nextVisit);
    this._maxDeepness      = config.get('maxDeepness', 5);
    this._followNewNow     = config.get('followNewNow', false);

    // Hash domain configs by domain name
    this._domainConfs = {};
    this._followDomains.forEach(entry => {
      this._domainConfs[entry.domain] = entry;
    });

    // Preload scraper modules
    this._followDomains.forEach(entry => {
      if ( !(entry.urlScrapers instanceof Array) ) return;
      entry.urlScrapers.forEach(urlConf => {
        urlConf.scraper = this._loadScraperModule(urlConf.scraper);
      });
    });

    console.info('Follow domains: ', this._followDomains);
  }

  _loadScraperModule(scraper) {
    if (!scraper || typeof scraper !== 'string')
      return scraper;
    if (!scraper.match(/^(.+)\.(\w+)$/))
      throw new Error(`Invalid scraper module.function name '${scraper}'`);

    const
      moduleName = `opencrawler-scraper-${RegExp.$1}`,
      funcName   = RegExp.$2;

    // Delete it from the module cache
    delete require.cache[require.resolve(moduleName)];

    const
      mod = require(moduleName);

    return mod[funcName];
  }

  _getDomainConf(domain, name, defaultValue) {
    let domainVal = (this._domainConfs[domain] || {})[name];
    if (domainVal === undefined) domainVal = this[`_${name}`];
    if (domainVal === undefined) domainVal = defaultValue;
    return domainVal;
  }


  async start() {
    console.info('Crawler is starting...');
    // Start the necessary modules
    await this._startModules();

    // Start the crawler loop (get items, fetch them, update items)
    this._startLoop();

    return this;
  }


  /*
   * Starts the crawler loop
   */
  async _startLoop() {
    let
      running = false;

    // Ensure configured items exist in the DB
    await this._ensureConfiguredItems();

    // Set an interval for a regular loop iteration
    setInterval(async () => {
      if (running) {
        return;
      }
      running = true;
      console.debug('Loop has started');

      await this._loopIteration();

      console.debug('Loop has finished');
      running = false;
    }, this._loopInterval);
  }


  /*
   * Ensure the main items for our configured domains exist.
   */
  async _ensureConfiguredItems() {
    const
      items = [],
      now = util.now();

    // Create items for each configured domain
    this._followDomains.map((domainConfig) => {
      // Robots
      items.push({
        Domain:     domainConfig.domain,
        URL:        `${domainConfig.protocol || 'http'}://${domainConfig.domain}/robots.txt`,
        LastVisit:  0,
        NextVisit:  0,
        FirstFound: {
          When: now,
          Where: 'oc://config',
        },
        LastFound: {
          When: now,
          Where: 'oc://config',
        },
        Deepness: 0,
      });
    });

    return this.storeItems(items, false);
  }

  /*
   * Get the configuration for a domain, assuming defaults
   */

  /*
   * Run a crawler loop
   */
  async _loopIteration(domain) {
    const
      now = util.now();
    let
      items,
      domainPrefix = '';


    // Domain independent cycles turned on and no domain? Run a loop for each domain
    if (this._domainCycles && !domain) {
      return util.eachPromise(
        this._followDomains,
        (domainConf) => {
          return this._loopIteration(domainConf.domain);
        },
        this._concurrentCycles
      );
    }

    if (domain) {
      domainPrefix = `[${domain}]: `;
    }

    console.log(`${domainPrefix}Running a loop${(domain?` for ${domain}`:'')}`);

    // Get items
    items = await this.retrieveItems(domain, this._cycleItems, now);

    // TODO: Check with the concurrency module which items can be fetched
//    console.log("WAIT");
//    await util.promiseWait(5000);

    if (items.length === 0) {
      console.info(`${domainPrefix}Nothing to do`);
      return;
    }
    console.info(`${domainPrefix}ITEMS: `, items.length);

    // Find the scrapers for these items
    const scrapers = this._findScrapers(items);

    // Fetch those items
    const results = await this.fetchItems(items, scrapers, {
      userAgent: this._userAgent,
    });

    // Complete results
    this._completeResults(results, items, now);

    // Store the results
    console.log(`${domainPrefix}Storing...`);
    console.log("RES: ", results);
    await this._storeResults(results, now);

    console.log(`${domainPrefix}Stored`);
  }

  _findScrapers(items) {
    return items.map(item => this._locateScraper(item));
  }

  _locateScraper(item) {
    const
      urlScrapers = this._getDomainConf(item.Domain, 'urlScrapers', []);
    let
      scraper = this._getDomainConf(item.Domain, 'scraper');

    // Find the matching one
    for (let x = 0; x < urlScrapers.length; x++) {
      const urlScraper = urlScrapers[x];
      let URL = item.URL;
      if (urlScraper.ignoreParameters) {
        URL = URL.replace(/\?.*$/, '');
      }
      if (URL.match(new RegExp(urlScraper.pattern))) {
        console.log(`Found the right scraper for ${item.URL}`);
        scraper = urlScraper.scraper;
        break;
      }
    }

    return scraper;
  }

  _completeResults(results, items, now) {
    // For each resulting item
    for (let x=0; x < results.length; x++) {
      const
        result      = results[x],
        item        = items[x],
        _nextVisit  = this._nextVisitGenerator(item, now);

        // Properties to copy
        result.URL        = item.URL;
        result.Domain     = item.Domain;
        result.FirstFound = item.FirstFound;
        result.Deepness   = item.Deepness;

        // Generate the time for next visit
        result.LastVisit  = now;
        result.NextVisit  = _nextVisit(item, now);
    }
  }

  _nextVisitGenerator(item, now) {
    let
      _nextVisit = this._getDomainConf(item.Domain, 'nextVisit');

    // Normalise the NextVisit generator
    if (typeof _nextVisit !== 'function' && typeof _nextVisit !== 'number')
      _nextVisit = this._nextVisit;
    if (typeof _nextVisit === 'number') {
      const val = _nextVisit;
      _nextVisit = () => now + val;
    }
    return _nextVisit;
  }

  // Default "nextVisit"
  nextVisit(item, now) {
    let nv;

    // Robots
    if (item.Type === 'robots') {
      return now + 86400 * 1000;
    }

    let deepness = item.Deepness;
    if (deepness <= 1) {
      nv = 120;
    }
    else if (deepness == 2) {
      nv = 900;
    }
    else {
      nv = 86400;
    }
    return now + ((nv * 1.05) * 1000);

  }

  async _storeResults(results, now) {
    const
      configs  = [],
      contents = [],
      links    = [],
      promises = [];

    results.forEach((result) => {
      if (!result) {
        return;
      }

      const
        maxDeepness = this._getDomainConf(result.Domain, 'maxDeepness', Infinity),
        followNewNow = this._getDomainConf(result.Domain, 'followNewNow', false);

      // Some static stuff
      if (result.Content) {
        if (result.Type === 'robots') {
          configs.push({ key: `robots.${result.Domain.replace(/\./g, '_')}`, value: result.Content });
        } else {
          Crawler._autoFillContent(result.Content, result);
          contents.push(result.Content);
        }
      }

      // Add the result links
      if (result.Links && result.Deepness < maxDeepness) {
        // FIXME: result has never .Protocol
        util.unique(result.Links).forEach((uri) => {
          const newItem = {
            Domain:     result.Domain,
            URL:        `${result.Protocol || 'http'}://${result.Domain}${uri}`,
            FirstFound: {
              When: now,
              Where: result.URL,
            },
            LastFound: {
              When: now,
              Where: result.URL,
            },
            LastVisit: 0,
            NextVisit: 0,
            Deepness: result.Deepness + 1,
          };

          // If we shouldn't follow it right now, make up a visit date
          if (!followNewNow)
            newItem.NextVisit = this.nextVisit(newItem, now);

          links.push(newItem);
        });
      }
    });

    // Create promises to store everything
    configs.forEach((entry) => {
      promises.push(this.setConfig(entry.key, entry.value));
    });
    if (contents.length > 0) {
      promises.push(this.storeContents(contents));
    }
    if (results.length > 0) {
      promises.push(this.storeItems(results, true));
    }
    if (links.length > 0) {
      promises.unshift(this.storeItems(links, false));
    }
    return Promise.all(promises);
  }

  static _autoFillContent(content, result) {
    ['URL', 'Domain'].forEach((field) => {
      if (!content[field] && result[field]) {
        content[field] = result[field];
      }
    });
  }
}

exports.Crawler = Crawler;

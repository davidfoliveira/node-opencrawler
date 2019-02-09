const
  modules         = require('../modules'),
  util            = require('./util'),
  ModularHandlers = require('./modular_handlers'),

  HANDLER_TYPES = {
    retrieveItems:  'storage',
    storeItems:     'storage',
    getConfig:      'storage',
    setConfig:      'storage',
    fetchItems:     'fetch',
    storeContents:  'storage',
  },
  DEFAULT_HANDLERS = {
    retrieveItems:  'sqlite3',
    storeItems:     'sqlite3',
    getConfig:      'sqlite3',
    setConfig:      'sqlite3',
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
    console.info('Follow domains: ', this._followDomains);
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
        FirstFound: {
          When: now,
          Where: 'oc://config',
        },
        LastFound: {
          When: now,
          Where: 'oc://config',
        }
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
  async _loopIteration(domain, domainConf) {
    let items;
    let domainPrefix = '';

    // Domain independent cycles turned on and no domain? Run a loop for each domain
    if (this._domainCycles && !domain) {
      return util.eachPromise(
        this._followDomains,
        (domainConf) => {
          return this._loopIteration(domainConf.domain, domainConf);
        },
        this._concurrentCycles
      );
    }

    if (domain) {
      domainPrefix = `[${domain}]: `;
    }

    console.log(`${domainPrefix}Running a loop${(domain?` for ${domain}`:'')}`);

    // Get items
    items = await this.retrieveItems(domain, this._cycleItems);

//    console.log("WAIT");
//    await util.promiseWait(5000);

    if (items.length === 0) {
      console.info(`${domainPrefix}Nothing to do`);
      return;
    }
    console.info(`${domainPrefix}ITEMS: `, items.length);

    // Fetch those items
    const results = await this.fetchItems(items, {
      userAgent: this._userAgent,
      urlReplace: domainConf.urlReplace || this._urlReplace
    });

    // Complete results
    this._completeResults(results, items);

    // Storate the results
    console.log(`${domainPrefix}Storing...`);
    console.log(results);
    await this._storeResults(results);

    console.log(`${domainPrefix}Stored`);
  }

  _completeResults(results, items) {
    for (let x=0; x < results.length; x++) {
      const
        result = results[x],
        item   = items[x];

        result.URL    = item.URL;
        result.Domain = item.Domain;
        result.FirstFound = item.FirstFound;
    }

  }

  async _storeResults(results) {
    const
      configs  = [],
      contents = [],
      links    = [],
      promises = [],
      now      = util.now();

    results.forEach((result) => {
      if (!result) {
        return;
      }

      // Some static stuff
      result.LastVisit = now;

      if (result.Content) {
        if (result.Type === 'robots') {
          configs.push({ key: `robots.${result.Domain.replace(/\./g, '_')}`, value: result.Content });
        } else if (result.Type === 'page') {
          Crawler._autoFillContent(result.Content, result);
          contents.push(result.Content);
        }
      }
      if (result.Links) {
        // FIXME: result has never .Protocol
        util.unique(result.Links).forEach((uri) => {
          links.push({
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
            LastVisit:  0,
          });
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

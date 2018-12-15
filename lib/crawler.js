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
    this._loopInterval = config.get('loopInterval');
    this._followDomains = config.get('followDomains');
    this._userAgent = config.get('userAgent', 'OpenCrawler/0.1');
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
    const items = [];
    // Create items for each configured domain
    this._followDomains.map((domainConfig) => {
      // Robots
      items.push({
        Domain:     domainConfig.domain,
        URL:        `${domainConfig.protocol || 'http'}://${domainConfig.domain}/robots.txt`,
        LastVisit:  0,
      });
    });

    return this.storeItems(items);
  }

  /*
   * Get the configuration for a domain, assuming defaults
   */

  /*
   * Run a crawler loop
   */
  async _loopIteration() {
    const items = await this.retrieveItems();

    if (items.length === 0) {
      console.info('Nothing to do');
      return;
    }
    console.info('ITEMS: ', items);

    // Fetch the items
    const results = await this.fetchItems(items, { userAgent: this._userAgent });

    // Storate the results
    console.log('Storing...');
    await this._storeResults(results);

    console.log('Stored');
  }

  async _storeResults(results) {
    const
      configs  = [],
      contents = [],
      items    = [],
      promises = [];

    results.forEach((result) => {
      if (!result) {
        return;
      }
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
          items.push({
            Domain:     result.Domain,
            URL:        `${result.Protocol || 'http'}://${result.Domain}${uri}`,
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
    if (items.length > 0) {
      promises.push(this.storeItems(items));
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

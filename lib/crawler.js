const
  modules         = require('../modules');
  util            = require('./util'),
  ModularHandlers = require('./modular_handlers'),

  HANDLER_TYPES = {
    retrieveItems:  'storage',
    storeItems:     'storage',
    processItems:   'process',
  },
  DEFAULT_HANDLERS = {
    retrieveItems:  'sqlite3',
    storeItems:     'sqlite3',
    processItems:   'local',
  };


class Crawler extends ModularHandlers {
  constructor(originalConfig) {
    const config = util.mutableConfig(originalConfig);

    // Call ModularHandlers constructor
    super(modules, HANDLER_TYPES, DEFAULT_HANDLERS, config);

    // Load configuration values and make them update in case the configuration changes
    this._loadConfig(config);
    if (config.on) {
      console.info("Updating configuration...");
      config.on('change', this._loadConfig);
    }

  }

  _loadConfig(config) {
    this._loopInterval = config.get("loopInterval");
    this._followDomains = config.get("followDomains");
    console.info("Follow domains: ", this._followDomains);
  }

  async start() {
    console.info("Crawler is starting...");
    // Start the necessary modules
    await this._startModules();

    // Start the crawler loop (get items, process them, update items)
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
      console.debug("Loop has started");

      await this._loopIteration();

      console.debug("Loop has finished");
      running = false;
    }, this._loopInterval);
  }

  /*
   * Ensure the main items for our configured domains exist.
   */
  async _ensureConfiguredItems() {
    const items = [];
    // Create items for each configured domain
    this._followDomains.map(domainConfig => {
      // Robots
      items.push({
        Domain:     domainConfig.domain,
        URL:        `${domainConfig.protocol || "http"}://${domainConfig.domain}/robots.txt`,
        LastVisit:  0,
      });
    });

    return await this.storeItems(items);
  }

  /*
   * Get the configuration for a domain, assuming defaults
   */

  /*
   * Run a crawler loop
   */
  async _loopIteration() {
    const items = await this.retrieveItems();

    if (items.length == 0) {
      console.info("Nothing to do");
      return;
    }
    console.info("ITEMS: ", items);

    // Process the items
    const results = await this.processItems(items);

    console.log("PROC results: ", results);

  }

}

exports.Crawler = Crawler;
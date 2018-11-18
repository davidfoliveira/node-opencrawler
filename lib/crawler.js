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
  constructor(config) {
    // Call ModularHandlers constructor
    super(modules, HANDLER_TYPES, DEFAULT_HANDLERS, config);

    // Copy some configs
    this._loopInterval = config.get("loopInterval");
  }

  async start() {
    // Start the necessary modules
    await this._startModules();

    // Start the crawler loop (get items, process them, update items)
    this._startLoop();

    return this;
  }

  /*
   * Starts the crawler loop
   */
  _startLoop() {
    const
      self = this;
    let
      running = false;

    setInterval(async () => {
      if (running) {
        return;
      }
      running = true;

      await self._loopIteration();
      running = false;
    }, this._loopInterval);
  }

  /*
   * Run a crawler loop
   */
  async _loopIteration() {
    const
      self = this,
      items = await self.retrieveItems();

    if (items.length == 0) {
      console.log("Nothing to do");
      return;
    }
    console.log("ITEMS: ", items);
  }

}

exports.Crawler = Crawler;
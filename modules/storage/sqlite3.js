const
  util = require('../../lib/util'),
  sqlite3 = require('sqlite3'),

  ROWFIELDS = ['_id', 'Domain', 'URL', 'LastVisit'];


class SQLite3 {
  constructor(config) {
    this.file = config.file || '/tmp/opencrawler.sqlite3';
  }

  /*
   * Start the SQLite3 module
   */
  async start() {
    // "Connect" to the database
    this.db = new sqlite3.Database(this.file);

    // Check if the tables exist and create them otherwise
    if (!await this._structureExists()) {
      console.log("Structure says NO");
      await this._createStructure();
    }
  }


  /*
   * Crawler handler for retrieving items from the DB
   */
  async retrieveItems() {
    console.log("RETRIEVEING TAKSSK");
    const lastVisit = util.now() - util.relativeTime('1h');
    return this._queryItems("SELECT "+ROWFIELDS.join(',')+",_data FROM Items WHERE LastVisit < ?", lastVisit);
  }

  /*
   * Crawler handler for storing items in the DB
   */
  async storeItems() {
    console.log("STORING TAKSSK");
  }


  /*
   *
   */
  async _structureExists() {
    const results = await this._query("SELECT name FROM sqlite_master WHERE type='table' AND name='items'");
    return results.length > 0;
  }

  /*
   *
   */
  async _createStructure() {
    await this._op("CREATE TABLE items (_id INTEGER PRIMARY KEY AUTOINCREMENT, Domain string, URL string, LastVisit INTEGER DEFAULT 0, _data string)");
  }

  /*
   * Run a query
   */
  _query(query, parameters) {
    const self = this;
    console.log("Q: "+query+" "+JSON.stringify(parameters||[]));
    return util.promisify((callback) => self.db.all(query, parameters || [], callback));
  }

  /*
   * Run an operation
   */
  _op(query, parameters) {
    const self = this;
    console.log("O: "+query+" "+JSON.stringify(parameters||[]));
    return util.promisify((callback) => self.db.run(query, parameters, callback));
  }

  /*
   * Perform a query and convert the results into items.
   */
  async _queryItems(query, ...parameters) {
    return SQLite3._resultsToItems(await this._query(query, parameters));
  }

  /*
   * Convert query results into items.
   */
  static _resultsToItems(results) {
    const items = [];
    return results.map((row) => {
      const item = JSON.parse(row._data || '{}');
      ROWFIELDS.forEach((field) => {
        item[field] = row[field];
      });
      return item;
    });
  }
}

exports.start = (config) => util.createModuleStarter(SQLite3, config);

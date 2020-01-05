const
  util = require('../../lib/util'),
  sqlite3 = require('sqlite3'),

  ITEM_ROWFIELDS = ['_id', 'Domain', 'URL', 'LastVisit', 'NextVisit'],
  CONTENT_ROWFIELDS = ['_id', 'Domain', 'URL'],
  STATIC_DATA_FIELDS = ['FirstFound'],
  STORE_REMOVE_FIELDS = ['Links', 'Content'],

  DEFAULT_CONF = {
    'sqlite3': {
      'file': '/tmp/opencrawler.sqlite3'
    }
  };


class SQLite3 {
  constructor(config) {
    this.file = config.file || '/tmp/opencrawler.sqlite3';
  }

  /*
   * Start the SQLite3 module
   */
  async start() {
    // 'Connect' to the database
    this.db = new sqlite3.Database(this.file);

    // Check if the tables exist and create them otherwise
    if (!await this._structureExists()) {
      console.debug('Structure says NO');
      await this._createStructure();
    }
  }

  /*
   * Hander for retrieving configuration parts
   */
  async getConfig(key) {
    const results = await this._query(query, parameters);
    if (results.length > 0) {
      const val = JSON.parse(results[0].Value);
      return val._val;
    }
    return undefined;
  }

  /*
   * Handler for storing configuration parts
   */
  async setConfig(key, value) {
    value = JSON.stringify({ _val: value });
    return this._op('INSERT INTO Config(key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=?', [key, value, value]);
  }

  /*
   * Crawler handler for retrieving items from the DB
   */
  async retrieveItems(domain, limit, now) {
    const
      filters = ['NextVisit < ?'],
      args = [now];

    // Filters
    if (domain) {
      filters.push('Domain=?');
      args.push(domain);
    }
    const filterStr = filters.join(' AND ');
    return this._queryItems('SELECT '+ITEM_ROWFIELDS.join(',')+`,_data,_staticData FROM Item WHERE ${filterStr} ORDER BY LastVisit ASC LIMIT ${limit}`, args);
  }

  /*
   * Crawler handler for storing items in the DB
   */
  async storeItems(items, overwrite) {
    items.forEach(item => {
      if (!item.URL) {
        throw Error("ITEM WITHOUT URL: "+JSON.stringify(item));
      }
    });
    return overwrite ? this._storeItemsOverwrite(items) : this._storeItemsIgnoreIfExists(items);
  }

  async _storeItemsIgnoreIfExists(items) {
    const storeOp = 'INSERT INTO Item ('+ITEM_ROWFIELDS.join(',')+',_data,_staticData) SELECT ?,?,?,?,?,?,? WHERE NOT EXISTS(SELECT 1 FROM Item WHERE URL=?)';
    const storePromises = items.map(item => {
      const args = SQLite3._objectToRow(item, ITEM_ROWFIELDS, true);
      args.push(item.URL);
      return this._op(storeOp, args);
    });
    return Promise.all(storePromises);    
  }

  async _storeItemsOverwrite(items) {
    // Build the update operation
    const
      insertOp = `INSERT OR IGNORE INTO Item(${ITEM_ROWFIELDS.join(',')},_data) VALUES (?,?,?,?,?,?)`,
      updateOp = 'UPDATE Item SET LastVisit=?, NextVisit=?, _data=? WHERE URL=?',
      storePromises = [];

    items.forEach(item => {
      const args = SQLite3._objectToRow(item, ITEM_ROWFIELDS);
      storePromises.push(this._op(insertOp, args));
      storePromises.push(this._op(updateOp, [item.LastVisit, item.NextVisit, args[args.length-1], item.URL]));
    });
    return Promise.all(storePromises);
  }

  /*
   * Crawler handler for storing contents
   */
  async storeContents(contents) {
    const storeOp = 'INSERT INTO Content ('+CONTENT_ROWFIELDS.join(',')+',_data) SELECT ?,?,?,? WHERE NOT EXISTS(SELECT 1 FROM Content WHERE URL=?)';
    const storePromises = contents.map(item => {
      const args = SQLite3._objectToRow(item, CONTENT_ROWFIELDS);
      args.push(item.URL);
      return this._op(storeOp, args);
    });
    return Promise.all(storePromises);
  }


  /*
   *
   */
  async _structureExists() {
    const results = await this._query('SELECT name FROM sqlite_master WHERE type=\'table\' AND name=\'Item\'');
    return results.length > 0;
  }

  /*
   *
   */
  async _createStructure() {
    await this._op('CREATE TABLE Item (_id INTEGER PRIMARY KEY AUTOINCREMENT, Domain string, URL string UNIQUE, LastVisit INTEGER DEFAULT 0, NextVisit INTEGER DEFAULT 0, _staticData string, _data string)');
    await this._op('CREATE TABLE Content (_id INTEGER PRIMARY KEY AUTOINCREMENT, Domain string NOT NULL, URL string NOT NULL, _staticData string, _data TEXT)');
    await this._op('CREATE TABLE Config (Key string PRIMARY KEY, Value string)');
  }

  /*
   * Run a query
   */
  _query(query, parameters) {
    const self = this;
    console.debug('Q: '+query+' '+JSON.stringify(parameters||[]));
    return util.promisify(callback => self.db.all(query, parameters || [], callback));
  }

  /*
   * Run an operation
   */
  _op(query, parameters) {
    const self = this;
//    console.debug('O: '+query+' '+JSON.stringify(parameters||[]));
    return util.promisify(callback => self.db.run(query, parameters, callback));
  }

  /*
   * Perform a query and convert the results into items.
   */
  async _queryItems(query, parameters) {
    return SQLite3._rowsToObjects(await this._query(query, parameters), ITEM_ROWFIELDS);
  }

  /*
   * Convert query results into items.
   */
  static _rowsToObjects(rows, fields) {
    const items = [];
    return rows.map(row => SQLite3._rowToObject(row, fields));
  }

  static _rowToObject(row, fields) {
    const item = {
      ...JSON.parse(row._data || '{}'),
      ...JSON.parse(row._staticData || '{}'),
    };
    fields.forEach(field => {
      item[field] = row[field];
    });
    return item;
  }

  static _objectToRow(item, fields, includeStaticData) {
    const row = fields.map(field => item[field]);
    const _data = Object.assign({}, item);
    fields.concat(STORE_REMOVE_FIELDS).concat(STATIC_DATA_FIELDS).forEach(field => {
      delete _data[field];
    });
    row.push(JSON.stringify(_data));

    if (includeStaticData) {
      const _staticData = {};
      STATIC_DATA_FIELDS.forEach(field => {
        _staticData[field] = item[field];
      });
      row.push(JSON.stringify(_staticData));
    }
    return row;
  }

  static _contentToRow(item) {
    const row = CONTENT_ROWFIELDS.map(field => item[field]);
    const _data = Object.assign({}, item);
    CONTENT_ROWFIELDS.forEach(field => {
      delete _data[field];
    });
    row.push(_data);
    return row;
  }
}

exports.start = config => util.createModuleStarter(SQLite3, config);

const
  util = require('../../lib/util'),
  fetcher = require('../../lib/fetcher');


class Local {
  constructor(config) {
    
  }

  async start() {
    console.log("Local fetcher START!!");
  }

  async fetchItems(items, opts) {
    console.log(`FETCH ${items.length} ITEMS`);
    const fetchPromises = items.map(item => fetcher.fetchItem(item, opts));
    return Promise.all(fetchPromises).then(results => {
      return results;
    });
  }
}

exports.start = config => util.createModuleStarter(Local, config);

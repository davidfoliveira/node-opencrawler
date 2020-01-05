const
  util = require('../../lib/util'),
  fetcher = require('../../lib/fetcher');


class Local {
  constructor(config) {
    
  }

  async start() {
    console.log("Local fetcher START!!");
  }

  async fetchItems(items, scrapers, opts) {
    const
      fetchPromises = [];

    console.log(`FETCH ${items.length} ITEMS`);
    for (let x = 0; x < items.length; x++) {
      const
        item = items[x],
        scraper = scrapers[x];

      fetchPromises.push(fetcher.fetchItem(item, scraper, opts));
    }

    return Promise.all(fetchPromises);
  }
}

exports.start = config => util.createModuleStarter(Local, config);

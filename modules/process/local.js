const
    processor = require('../../lib/processor');


class Local {
  constructor(config) {
    
  }

  async start() {
    console.log("Local processor START!!");
  }

  async processItems(items) {
    console.log(`PROCESS ${items.length} ITEMS`);
    const fetchPromises = items.map(item => processor.fetchItem(item));
    return Promise.all(fetchPromises).then(results => {
      console.log("RES: ", results);
      return results;
    });
  }
}

exports.start = config => util.createModuleStarter(Local, config);

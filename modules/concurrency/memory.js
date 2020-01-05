const
  util = require('../../lib/util');


class Memory {
  constructor(config) {
    
  }

  async start() {
    console.log("Memory concurrency module START!!");
  }


  canFetchItems(items) {
    return items;
  }
};


exports.start = config => util.createModuleStarter(Memory, config);
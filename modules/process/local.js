class Local {
  constructor(config) {
    
  }

  async start() {
    console.log("Local processor START!!");
  }

  async processItems(items) {
    console.log(`PROCESS ${items.length} ITEMS`);
  }

}

exports.start = (config) => util.createModuleStarter(Local, config);

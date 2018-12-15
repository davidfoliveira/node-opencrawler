const
  config = require('config'),
  crawler = require('../');


(async () => {
  await crawler.start(config);
})();

const
  config = require('config'),
  crawler = require('../');


(async () => {
  const c = await crawler.start(config);
  console.log(c);
})();
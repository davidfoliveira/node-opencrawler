const
  fs        = require('fs'),
  robots    = require('../lib/robots'),
  content   = fs.readFileSync(__dirname + '/data/robots.txt'),
  loadTimes = 100000;

let
  robotsData,
  agentRules,
  start, diff;

robotsData = robots.parse(content);
//console.log(robotsData);

agentRules = robots.userAgentRules(robotsData, 'twitterbot');
console.log("RULES: ", agentRules.rules.length);

// start = new Date();
// for(let x=0; x < loadTimes; x++) {
//   robots.isURLAllowed(agentRules, '/imgres?q=bofof');
// }
// diff = (new Date()).getTime()-start.getTime();
// console.log(`DID ${loadTimes} tests in ${diff}ms`);
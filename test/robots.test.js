const
  fs        = require('fs'),
  robots    = require('../lib/robots'),
  content   = fs.readFileSync(__dirname + '/data/robots.txt');

console.log(robots.parse(content));
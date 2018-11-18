exports.parse = (content, headers) => {
  const
    robots = {
      rules: [],
      sitemaps: []
    };
  let
    prev = 0,
    curRule = null;

  content = content.toString();
  while(prev < content.length) {
    const
      newLineLoc = content.indexOf('\n', prev),
      line = content.substr(prev, newLineLoc - prev).replace(/\r/g, "");

    prev = newLineLoc + 1;
    if (!line.match(/^\s*([a-zA-Z-]+)\s*:\s*(.+?)\s*$/i)) {
        continue;
    }

    const
      value     = RegExp.$2,
      directive = RegExp.$1.toLowerCase();

    if (directive === "user-agent") {
      curRule = { 'user-agent': value, disallow: [], allow: [] };
      robots.rules.push(curRule);
    }
    if (!curRule) {
      continue;
    }

    if (directive === 'disallow') {
      curRule.disallow.push(value);
    }
    else if (directive === 'allow') {
      curRule.allow.push(value);
    }
    else if (directive === 'crawl-delay') {
      curRule.crawlDelay = parseInt(value, 10);
    }
    else if (directive === 'sitemap') {
      robots.sitemaps.push(value);
    }
  }

  return robots;
};

const
  matcher = require('matcher');


exports.parse = (content) => {
  const
    robots = {
      userAgents: [],
      sitemaps: [],
    };
  let
    prev = 0,
    curUA = null;

  content = content.toString();
  while (prev < content.length) {
    const
      newLineLoc = content.indexOf('\n', prev);

    if (newLineLoc < 0) {
      break;
    }

    const
      line = content.substr(prev, newLineLoc - prev).replace(/\r/g, '');
    prev = newLineLoc + 1;
    if (!line.match(/^\s*([a-zA-Z-]+)\s*:\s*(.+?)\s*$/i)) {
      continue;
    }

    const
      value     = RegExp.$2,
      directive = RegExp.$1.toLowerCase();

    if (directive === 'user-agent') {
      curUA = {
        filter:  value,
        rules:      [],
        crawlDelay: undefined,
      };
      robots.userAgents.push(curUA);
    }
    if (!curUA) {
      continue;
    }

    if (directive === 'disallow') {
      curUA.rules.push({ type: 'disallow', value });
    } else if (directive === 'allow') {
      curUA.rules.push({ type: 'allow', value });
    } else if (directive === 'crawl-delay') {
      curUA.crawlDelay = parseInt(value, 10);
    } else if (directive === 'sitemap') {
      robots.sitemaps.push(value);
    }
  }

  return robots;
};

exports.userAgentRules = (robots, userAgentName) => {
  const
    globalAgent = {
      rules:      [],
      crawlDelay: undefined,
    },
    filteredAgent = {
      rules:      [],
      crawlDelay: undefined,
    };

  robots.userAgents.forEach((userAgent) => {
    let ruleGroup = null;
    if (userAgent.filter === '*') {
      ruleGroup = globalAgent;
    } else if (userAgentName.toLowerCase().includes(userAgent.filter.toLowerCase())) {
      ruleGroup = filteredAgent;
    }

    // Update the corresponding user group
    if (ruleGroup) {
      ruleGroup.rules = ruleGroup.rules.concat(userAgent.rules);
      if (userAgent.crawlDelay) {
        ruleGroup.crawlDelay = userAgent.crawlDelay;
      }
    }
  });

  // Merge global and agent rules
  return {
    rules:      globalAgent.rules.concat(filteredAgent.rules),
    crawlDelay: globalAgent.crawlDelay || filteredAgent.crawlDelay,
  };
};

/*
 * TODO: check if we could speed this up (100k URLs take 6993ms to check on a 267 rule robots file)
 */
exports.isURLAllowed = (agentRules, url) => {
  let
    allowed = null;

  agentRules.rules.forEach((rule) => {
    if (this.urlMatches(rule.value, url)) {
      allowed = (rule.type === 'allow');
    }
  });

  return (allowed != null) ? allowed : true;
};

exports.urlMatches = (expr, url) => {
  // If it contains a wildcard, we use matcher
  if (expr.includes('*')) {
    return matcher.isMatch(url, expr);
  }

  // Otherwise, we just ensure if it starts with the expression
  return url.startsWith(expr);
};

// All builtin modules
const MODULES = {
  storage: ['sqlite3'],
  fetch: ['local']
};

// Initialize module type structure
Object.keys(MODULES).forEach(moduleType => {
  exports[moduleType] = {};
});

// Load the builtin modules
Object.keys(MODULES).forEach(moduleType => {
  MODULES[moduleType].forEach(moduleName => {
    exports[moduleType][moduleName] = require(`./${moduleType}/${moduleName}`);
  });
});

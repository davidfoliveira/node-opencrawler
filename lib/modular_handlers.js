const
  util = require('./util');


class ModularHandlers {
  constructor(moduleTree, handlerTypes, defaultHandlers, config) {
    // Gather handler modules from the config and store them in a specific objects
    this._handlerMods = ModularHandlers._resolveHandlerMods(handlerTypes, defaultHandlers, config);

    // Load external modules
    this._moduleIntances = ModularHandlers._loadModules(moduleTree, this._handlerMods);

    // Store module config
    this._moduleConfig = ModularHandlers._gatherModuleConfigs(this._handlerMods, config);
  }

  /*
   * Resolve module names in configuration (or defaults) to the actual module paths.
   */
  static _resolveHandlerMods(handlerTypes, defaultHandlers, config) {
    const handlerModules = {};
    // For each handler, map to already loaded modules
    Object.keys(handlerTypes).forEach((handlerName) => {
      const
        moduleType = handlerTypes[handlerName],
        moduleName = config.get(handlerName, defaultHandlers[handlerName]);
      //   module = modules[moduleType] ? modules[moduleType][handlerName] : undefined;
      // handlers[handlerName] = module || require(`opencrawler-${moduleType}-${moduleName}`);
      handlerModules[handlerName] = `${moduleType}.${moduleName}`;
    });
    return handlerModules;
  }

  /*
   * Point handlers to actual module instance and load necessary external modules.
   */
  static _loadModules(moduleTree, handlerModules) {
    const moduleInstances = {};
    Object.keys(handlerModules).forEach((handlerName) => {
      const
        modulePath = handlerModules[handlerName],
        [moduleType, moduleName] = modulePath.split('.'),
        module = moduleTree[moduleType] ? moduleTree[moduleType][moduleName] : undefined;
      // eslint-disable-next-line global-require, import/no-dynamic-require
      moduleInstances[modulePath] = module || require(`opencrawler-${moduleType}-${moduleName}`);
    });
    return moduleInstances;
  }

  /*
   * Gather the necessary module configs to be used later on (we don't want a
   * reference for all the config)
   */
  static _gatherModuleConfigs(handlerModules, config) {
    const
      moduleConfigs = config.get('modules', null),
      configs = {};
    Object.keys(handlerModules).forEach((handlerName) => {
      const
        modulePath = handlerModules[handlerName];
      const
        moduleName = (modulePath.split('.'))[1];
      configs[modulePath] = moduleConfigs ? moduleConfigs.get(moduleName, {}) : {};
    });
    return configs;
  }

  /*
   * Starts all modules
   */
  async _startModules() {
    const
      startPromises = {};

    // Call start() on all modules and store their start() promises
    ModularHandlers._allModules(this._handlerMods).forEach((modulePath) => {
      startPromises[modulePath] = this._moduleIntances[modulePath].start(
        this._moduleConfig[modulePath],
      );
    });

    // Wait for all promises and replace module instances
    this._moduleIntances = await util.PromiseAllObject(startPromises);

    // Point handlers to module instance methods
    this._setHandlers();
  }

  /*
   * Gets all unique modules mentioned in handlers.
   */
  static _allModules(handlerModules) {
    const allModules = new Set();
    Object.keys(handlerModules).forEach(handlerName => allModules.add(handlerModules[handlerName]));
    return Array.from(allModules);
  }

  /*
   * Points handlers to their corresponding module functions
   */
  _setHandlers() {
    Object.keys(this._handlerMods).forEach((handlerName) => {
      const
        modulePath = this._handlerMods[handlerName],
        module = this._moduleIntances[modulePath];
      if (!module[handlerName]) {
        throw Error(`Module "${modulePath}" does not support method "${handlerName}"`);
      }
      // eslint-disable-next-line prefer-spread
      this[handlerName] = (...args) => module[handlerName].apply(module, args);
    });
  }
}

module.exports = ModularHandlers;

'use strict';

/**
@module ember-cli
*/
const fs = require('fs');
const path = require('path');
const p = require('ember-cli-preprocess-registry/preprocessors');
const chalk = require('chalk');
const resolve = require('resolve');

const { assert } = require('../debug');
const Project = require('../models/project');

const concat = require('broccoli-concat');
const BroccoliDebug = require('broccoli-debug');
const mergeTrees = require('./merge-trees');
const broccoliMergeTrees = require('broccoli-merge-trees');
const WatchedDir = require('broccoli-source').WatchedDir;
const UnwatchedDir = require('broccoli-source').UnwatchedDir;

const merge = require('lodash/merge');
const defaultsDeep = require('lodash/defaultsDeep');
const omitBy = require('lodash/omitBy');
const isNull = require('lodash/isNull');
const Funnel = require('broccoli-funnel');
const logger = require('heimdalljs-logger')('ember-cli:ember-app');
const addonProcessTree = require('../utilities/addon-process-tree');
const lintAddonsByType = require('../utilities/lint-addons-by-type');
const DefaultPackager = require('./default-packager');

let DEFAULT_CONFIG = {
  storeConfigInMeta: true,
  autoRun: true,
  minifyCSS: {
    options: { relativeTo: 'assets' },
  },
  sourcemaps: {},
  trees: {},
  addons: {},
};

class EmberApp {
  /**
   EmberApp is the main class Ember CLI uses to manage the Broccoli trees
   for your application. It is very tightly integrated with Broccoli and has
   a `toTree()` method you can use to get the entire tree for your application.

   Available init options:
   - storeConfigInMeta, defaults to `true`
   - autoRun, defaults to `true`
   - minifyCSS, defaults to `{enabled: !!isProduction,options: { relativeTo: 'assets' }}
   - sourcemaps, defaults to `{}`
   - trees, defaults to `{}`
   - vendorFiles, defaults to `{}`
   - addons, defaults to `{ exclude: [], include: [] }`

   @class EmberApp
   @constructor
   @param {Object} [defaults]
   @param {Object} [options={}] Configuration options
   */
  constructor(defaults, options) {
    if (arguments.length === 0) {
      options = {};
    } else if (arguments.length === 1) {
      options = defaults;
    } else {
      defaultsDeep(options, defaults);
    }

    this._initProject(options);
    this.name = options.name || this.project.name();

    this.env = EmberApp.env();
    this.isProduction = this.env === 'production';

    this.registry = options.registry || p.defaultRegistry(this);

    this._initTestsAndHinting(options);
    this._initOptions(options);
    this._initVendorFiles();

    this._styleOutputFiles = {};

    // ensure addon.css always gets concated
    this._styleOutputFiles[this.options.outputPaths.vendor.css] = [];

    this._scriptOutputFiles = {};
    this._customTransformsMap = new Map();

    this.otherAssetPaths = [];
    this.legacyTestFilesToAppend = [];
    this.vendorTestStaticStyles = [];
    this._nodeModules = new Map();

    this.trees = this.options.trees;

    this.populateLegacyFiles();
    this.initializeAddons();
    this.project.addons.forEach((addon) => (addon.app = this));
    p.setupRegistry(this);
    this._importAddonTransforms();
    this._notifyAddonIncluded();

    this._debugTree = BroccoliDebug.buildDebugCallback('ember-app');

    this._defaultPackager = new DefaultPackager({
      env: this.env,
      name: this.name,
      autoRun: this.options.autoRun,
      project: this.project,
      registry: this.registry,
      sourcemaps: this.options.sourcemaps,
      minifyCSS: this.options.minifyCSS,
      areTestsEnabled: this.tests,
      styleOutputFiles: this._styleOutputFiles,
      scriptOutputFiles: this._scriptOutputFiles,
      storeConfigInMeta: this.options.storeConfigInMeta,
      customTransformsMap: this._customTransformsMap,
      additionalAssetPaths: this.otherAssetPaths,
      vendorTestStaticStyles: this.vendorTestStaticStyles,
      legacyTestFilesToAppend: this.legacyTestFilesToAppend,
      distPaths: {
        appJsFile: this.options.outputPaths.app.js,
        appCssFile: this.options.outputPaths.app.css,
        testJsFile: this.options.outputPaths.tests.js,
        appHtmlFile: this.options.outputPaths.app.html,
        vendorJsFile: this.options.outputPaths.vendor.js,
        vendorCssFile: this.options.outputPaths.vendor.css,
        testSupportJsFile: this.options.outputPaths.testSupport.js,
        testSupportCssFile: this.options.outputPaths.testSupport.css,
      },
    });

    this._cachedAddonBundles = {};

    if (this.project.perBundleAddonCache && this.project.perBundleAddonCache.numProxies > 0) {
      if (this.options.addons.include && this.options.addons.include.length) {
        throw new Error(
          [
            `[ember-cli] addon bundle caching is disabled for apps that specify an addon "include"`,
            '',
            'All addons using bundle caching:',
            ...this.project.perBundleAddonCache.getPathsToAddonsOptedIn(),
          ].join('\n')
        );
      }

      if (this.options.addons.exclude && this.options.addons.exclude.length) {
        throw new Error(
          [
            `[ember-cli] addon bundle caching is disabled for apps that specify an addon "exclude"`,
            '',
            'All addons using bundle caching:',
            ...this.project.perBundleAddonCache.getPathsToAddonsOptedIn(),
          ].join('\n')
        );
      }
    }
  }

  /**
    Initializes the `tests` and `hinting` properties.

    Defaults to `false` unless `ember test` was used or this is *not* a production build.

    @private
    @method _initTestsAndHinting
    @param {Object} options
  */
  _initTestsAndHinting(options) {
    let testsEnabledDefault = process.env.EMBER_CLI_TEST_COMMAND === 'true' || !this.isProduction;

    this.tests = 'tests' in options ? options.tests : testsEnabledDefault;
    this.hinting = 'hinting' in options ? options.hinting : testsEnabledDefault;
  }

  /**
    Initializes the `project` property from `options.project` or the
    closest Ember CLI project from the current working directory.

    @private
    @method _initProject
    @param {Object} options
  */
  _initProject(options) {
    let app = this;

    this.project = options.project || Project.closestSync(process.cwd());

    if (options.configPath) {
      this.project.configPath = function () {
        return app._resolveLocal(options.configPath);
      };
      this.project.configCache.clear();
    }
  }

  /**
    Initializes the `options` property from the `options` parameter and
    a set of default values from Ember CLI.

    @private
    @method _initOptions
    @param {Object} options
  */
  _initOptions(options) {
    let resolvePathFor = (defaultPath, specified) => {
      let path = defaultPath;
      if (specified && typeof specified === 'string') {
        path = specified;
      }
      let resolvedPath = this._resolveLocal(path);

      return resolvedPath;
    };

    let buildTreeFor = (defaultPath, specified, shouldWatch) => {
      if (specified !== null && specified !== undefined && typeof specified !== 'string') {
        return specified;
      }

      let tree = null;
      let resolvedPath = resolvePathFor(defaultPath, specified);
      if (fs.existsSync(resolvedPath)) {
        if (shouldWatch !== false) {
          tree = new WatchedDir(resolvedPath);
        } else {
          tree = new UnwatchedDir(resolvedPath);
        }
      }

      return tree;
    };
    let trees = (options && options.trees) || {};

    let appTree = buildTreeFor('app', trees.app);
    let testsTree = buildTreeFor('tests', trees.tests, options.tests);

    // these are contained within app/ no need to watch again
    // (we should probably have the builder or the watcher dedup though)
    this._stylesPath = resolvePathFor('app/styles', trees.styles);

    let stylesTree = null;
    if (fs.existsSync(this._stylesPath)) {
      stylesTree = new UnwatchedDir(this._stylesPath);
    }

    let templatesTree = buildTreeFor('app/templates', trees.templates, false);
    let vendorTree = buildTreeFor('vendor', trees.vendor);
    let publicTree = buildTreeFor('public', trees.public);

    let detectedDefaultOptions = {
      babel: {},
      minifyCSS: {
        enabled: this.isProduction,
        options: { processImport: false },
      },
      sourcemaps: {
        enabled: !this.isProduction,
        extensions: ['js'],
      },
      trees: {
        app: appTree,
        tests: testsTree,
        styles: stylesTree,
        templates: templatesTree,
        vendor: vendorTree,
        public: publicTree,
      },
    };

    let emberCLIBabelInstance = this.project.findAddonByName('ember-cli-babel');
    if (emberCLIBabelInstance) {
      detectedDefaultOptions['ember-cli-babel'] = detectedDefaultOptions['ember-cli-babel'] || {};
      detectedDefaultOptions['ember-cli-babel'].compileModules = true;
    }

    this.options = defaultsDeep(options, detectedDefaultOptions, DEFAULT_CONFIG);

    // Keep `outputPaths` on `this.options` for now, because ember-auto-import reads it here:
    // https://github.com/embroider-build/ember-auto-import/blob/ce42c052151ca39e74955212a963fcf3091d7c90/packages/ember-auto-import/ts/auto-import.ts#L84
    this.options.outputPaths = {
      app: {
        css: {
          app: `/assets/${this.name}.css`,
        },
        html: 'index.html',
        js: `/assets/${this.name}.js`,
      },
      tests: {
        js: '/assets/tests.js',
      },
      vendor: {
        css: '/assets/vendor.css',
        js: '/assets/vendor.js',
      },
      testSupport: {
        css: '/assets/test-support.css',
        js: {
          testSupport: '/assets/test-support.js',
          testLoader: '/assets/test-loader.js',
        },
      },
    };

    // For now we must disable Babel sourcemaps due to unforeseen
    // performance regressions.
    if (!('sourceMaps' in this.options.babel)) {
      this.options.babel.sourceMaps = false;
    }

    // Add testem.js to excludes for broccoli-asset-rev.
    // This will allow tests to run against the production builds.
    this.options.fingerprint = this.options.fingerprint || {};
    this.options.fingerprint.exclude = this.options.fingerprint.exclude || [];
    this.options.fingerprint.exclude.push('testem');
  }

  /**
    Resolves a path relative to the project's root

    @private
    @method _resolveLocal
  */
  _resolveLocal(to) {
    return path.join(this.project.root, to);
  }

  /**
    @private
    @method _initVendorFiles
  */
  _initVendorFiles() {
    let emberSource = this.project.findAddonByName('ember-source');

    assert(
      'Could not find `ember-source`. Please install `ember-source` by running `ember install ember-source`.',
      emberSource
    );

    this.vendorFiles = omitBy(
      merge(
        {
          'ember.js': {
            development: emberSource.paths.debug,
            production: emberSource.paths.prod,
          },
          'ember-testing.js': [emberSource.paths.testing, { type: 'test' }],
        },
        this.options.vendorFiles
      ),
      isNull
    );
  }

  /**
    Returns the environment name

    @public
    @static
    @method env
    @return {String} Environment name
   */
  static env() {
    return process.env.EMBER_ENV || 'development';
  }

  /**
    Delegates to `broccoli-concat` with the `sourceMapConfig` option set to `options.sourcemaps`.

    @private
    @method _concatFiles
    @param tree
    @param options
    @return
  */
  _concatFiles(tree, options) {
    options.sourceMapConfig = this.options.sourcemaps;

    return concat(tree, options);
  }

  /**
    Checks the result of `addon.isEnabled()` if it exists, defaults to `true` otherwise.

    @private
    @method _addonEnabled
    @param {Addon} addon
    @return {Boolean}
  */
  _addonEnabled(addon) {
    return !addon.isEnabled || addon.isEnabled();
  }

  /**
    @private
    @method _addonDisabledByExclude
    @param {Addon} addon
    @return {Boolean}
  */
  _addonDisabledByExclude(addon) {
    let exclude = this.options.addons.exclude;
    return !!exclude && exclude.indexOf(addon.name) !== -1;
  }

  /**
    @private
    @method _addonDisabledByInclude
    @param {Addon} addon
    @return {Boolean}
  */
  _addonDisabledByInclude(addon) {
    let include = this.options.addons.include;
    return !!include && include.indexOf(addon.name) === -1;
  }

  /**
    Returns whether an addon should be added to the project

    @private
    @method shouldIncludeAddon
    @param {Addon} addon
    @return {Boolean}
  */
  shouldIncludeAddon(addon) {
    if (!this._addonEnabled(addon)) {
      return false;
    }

    return !this._addonDisabledByExclude(addon) && !this._addonDisabledByInclude(addon);
  }

  /**
    Calls the included hook on addons.

    @private
    @method _notifyAddonIncluded
  */
  _notifyAddonIncluded() {
    let addonNames = this.project.addons.map((addon) => addon.name);

    if (this.options.addons.exclude) {
      this.options.addons.exclude.forEach((addonName) => {
        if (addonNames.indexOf(addonName) === -1) {
          throw new Error(`Addon "${addonName}" defined in "exclude" is not found`);
        }
      });
    }

    if (this.options.addons.include) {
      this.options.addons.include.forEach((addonName) => {
        if (addonNames.indexOf(addonName) === -1) {
          throw new Error(`Addon "${addonName}" defined in "include" is not found`);
        }
      });
    }

    // the addons must be filtered before the `included` hook is called
    // in case an addon caches the project.addons list
    this.project.addons = this.project.addons.filter((addon) => this.shouldIncludeAddon(addon));

    this.project.addons.forEach((addon) => {
      if (addon.included) {
        addon.included(this);
      }
    });
  }

  /**
    Calls the importTransforms hook on addons.

    @private
    @method _importAddonTransforms
  */
  _importAddonTransforms() {
    this.project.addons.forEach((addon) => {
      if (this.shouldIncludeAddon(addon)) {
        if (addon.importTransforms) {
          let transforms = addon.importTransforms();

          if (!transforms) {
            throw new Error(`Addon "${addon.name}" did not return a transform map from importTransforms function`);
          }

          Object.keys(transforms).forEach((transformName) => {
            let transformConfig = {
              files: [],
              options: {},
            };

            // store the transform info
            if (typeof transforms[transformName] === 'object') {
              transformConfig['callback'] = transforms[transformName].transform;
              transformConfig['processOptions'] = transforms[transformName].processOptions;
            } else if (typeof transforms[transformName] === 'function') {
              transformConfig['callback'] = transforms[transformName];
              transformConfig['processOptions'] = (assetPath, entry, options) => options;
            } else {
              throw new Error(
                `Addon "${addon.name}" did not return a callback function correctly for transform "${transformName}".`
              );
            }

            if (this._customTransformsMap.has(transformName)) {
              // there is already a transform with a same name, therefore we warn the user
              this.project.ui.writeWarnLine(
                `Addon "${addon.name}" is defining a transform name: ${transformName} that is already being defined. Using transform from addon: "${addon.name}".`
              );
            }

            this._customTransformsMap.set(transformName, transformConfig);
          });
        }
      }
    });
  }

  /**
    Loads and initializes addons for this project.
    Calls initializeAddons on the Project.

    @private
    @method initializeAddons
  */
  initializeAddons() {
    this.project.initializeAddons();
  }

  _addonTreesFor(type) {
    return this.project.addons.reduce((sum, addon) => {
      if (addon.treeFor) {
        let tree = addon.treeFor(type);
        if (tree && !mergeTrees.isEmptyTree(tree)) {
          sum.push({
            name: addon.name,
            tree,
            root: addon.root,
          });
        }
      }
      return sum;
    }, []);
  }

  /**
    Returns a list of trees for a given type, returned by all addons.

    @private
    @method addonTreesFor
    @param  {String} type Type of tree
    @return {Array}       List of trees
   */
  addonTreesFor(type) {
    return this._addonTreesFor(type).map((addonBundle) => addonBundle.tree);
  }

  /**
    Runs addon post-processing on a given tree and returns the processed tree.

    This enables addons to do process immediately **after** the preprocessor for a
    given type is run, but before concatenation occurs. If an addon wishes to
    apply a transform before the preprocessors run, they can instead implement the
    preprocessTree hook.

    To utilize this addons implement `postprocessTree` hook.

    An example, would be to apply some broccoli transform on all JS files, but
    only after the existing pre-processors have run.

    ```js
    module.exports = {
      name: 'my-cool-addon',
      postprocessTree(type, tree) {
        if (type === 'js') {
          return someBroccoliTransform(tree);
        }

        return tree;
      }
    }

    ```

    @private
    @method addonPostprocessTree
    @param  {String} type Type of tree
    @param  {Tree}   tree Tree to process
    @return {Tree}        Processed tree
   */
  addonPostprocessTree(type, tree) {
    return addonProcessTree(this.project, 'postprocessTree', type, tree);
  }

  /**
    Runs addon pre-processing on a given tree and returns the processed tree.

    This enables addons to do process immediately **before** the preprocessor for a
    given type is run.  If an addon wishes to apply a transform  after the
    preprocessors run, they can instead implement the postprocessTree hook.

    To utilize this addons implement `preprocessTree` hook.

    An example, would be to remove some set of files before the preprocessors run.

    ```js
    var stew = require('broccoli-stew');

    module.exports = {
      name: 'my-cool-addon',
      preprocessTree(type, tree) {
        if (type === 'js' && type === 'template') {
          return stew.rm(tree, someGlobPattern);
        }

        return tree;
      }
    }
    ```

    @private
    @method addonPreprocessTree
    @param  {String} type Type of tree
    @param  {Tree}   tree Tree to process
    @return {Tree}        Processed tree
   */
  addonPreprocessTree(type, tree) {
    return addonProcessTree(this.project, 'preprocessTree', type, tree);
  }

  /**
    Runs addon lintTree hooks and returns a single tree containing all
    their output.

    @private
    @method addonLintTree
    @param  {String} type Type of tree
    @param  {Tree}   tree Tree to process
    @return {Tree}        Processed tree
   */
  addonLintTree(type, tree) {
    let output = lintAddonsByType(this.project.addons, type, tree);

    return mergeTrees(output, {
      overwrite: true,
      annotation: `TreeMerger (lint ${type})`,
    });
  }

  /**
    Imports legacy imports in this.vendorFiles

    @private
    @method populateLegacyFiles
  */
  populateLegacyFiles() {
    let name;
    for (name in this.vendorFiles) {
      let args = this.vendorFiles[name];

      if (args === null) {
        continue;
      }

      this.import.apply(this, [].concat(args));
    }
  }

  podTemplates() {
    return new Funnel(this.trees.app, {
      include: this._podTemplatePatterns(),
      exclude: ['templates/**/*'],
      destDir: this.name,
      annotation: 'Funnel: Pod Templates',
    });
  }

  _templatesTree() {
    if (!this._cachedTemplateTree) {
      let trees = [];
      if (this.trees.templates) {
        let standardTemplates = new Funnel(this.trees.templates, {
          srcDir: '/',
          destDir: `${this.name}/templates`,
          annotation: 'Funnel: Templates',
        });

        trees.push(standardTemplates);
      }

      if (this.trees.app) {
        trees.push(this.podTemplates());
      }

      this._cachedTemplateTree = mergeTrees(trees, {
        annotation: 'TreeMerge (templates)',
      });
    }

    return this._cachedTemplateTree;
  }

  /*
   * Gather application and add-ons javascript files and return them in a single
   * tree.
   *
   * Resulting tree:
   *
   * ```
   * the-best-app-ever/
   * ├── adapters
   * │   └── application.js
   * ├── app.js
   * ├── components
   * ├── controllers
   * ├── helpers
   * │   ├── and.js
   * │   ├── app-version.js
   * │   ├── await.js
   * │   ├── camelize.js
   * │   ├── cancel-all.js
   * │   ├── dasherize.js
   * │   ├── dec.js
   * │   ├── drop.js
   * │   └── eq.js
   * ...
   * ```
   *
   * Note, files in the example are "made up" and will differ from the real
   * application.
   *
   * @private
   * @method getAppJavascript
   * @return {BroccoliTree}
   */
  getAppJavascript() {
    let appTrees = [].concat(this.addonTreesFor('app'), this.trees.app).filter(Boolean);

    let mergedApp = mergeTrees(appTrees, {
      overwrite: true,
      annotation: 'TreeMerger (app)',
    });

    let appTree = new Funnel(mergedApp, {
      srcDir: '/',
      destDir: this.name,
      annotation: 'ProcessedAppTree',
    });

    return appTree;
  }

  /*
   * Gather add-ons style (css/sass/less) files and return them in a single
   * tree.
   *
   * Resulting tree:
   *
   * ```
   * the-best-app-ever/
   * └── app
   *     └── styles
   *         ├── ember-basic-dropdown.scss
   *         └── ember-power-select.scss
   * ```
   *
   * @private
   * @method getStyles
   * @return {BroccoliTree}
   */
  getStyles() {
    let styles;
    if (this.trees.styles) {
      styles = new Funnel(this.trees.styles, {
        srcDir: '/',
        destDir: '/app/styles',
        annotation: 'Funnel (styles)',
      });
    }
    let addons = this.addonTreesFor('styles');

    styles = mergeTrees(addons.concat(styles), {
      overwrite: true,
      annotation: 'Styles',
    });

    return styles;
  }

  /*
   * Gather add-ons template files and return them in a single tree.
   *
   * Resulting tree:
   *
   * ```
   * the-best-app-ever/
   * └── templates
   *     ├── application.hbs
   *     ├── error.hbs
   *     ├── index.hbs
   *     └── loading.hbs
   * ```
   *
   * Note, files in the example are "made up" and will differ from the real
   * application.
   *
   * @private
   * @method getAddonTemplates
   * @return {BroccoliTree}
   */
  getAddonTemplates() {
    let addonTrees = this.addonTreesFor('templates');
    let mergedTemplates = mergeTrees(addonTrees, {
      overwrite: true,
      annotation: 'TreeMerger (templates)',
    });

    let addonTemplates = new Funnel(mergedTemplates, {
      srcDir: '/',
      destDir: `${this.name}/templates`,
      annotation: 'ProcessedTemplateTree',
    });

    return addonTemplates;
  }

  /**
    @private
    @method _podTemplatePatterns
    @return {Array} An array of regular expressions.
  */
  _podTemplatePatterns() {
    return this.registry.extensionsForType('template').map((extension) => `**/*/template.${extension}`);
  }

  _nodeModuleTrees() {
    if (!this._cachedNodeModuleTrees) {
      this._cachedNodeModuleTrees = Array.from(
        this._nodeModules.values(),
        (module) =>
          new Funnel(module.path, {
            srcDir: '/',
            destDir: `node_modules/${module.name}/`,
            annotation: `Funnel (node_modules/${module.name})`,
          })
      );
    }

    return this._cachedNodeModuleTrees;
  }

  _addonBundles(type) {
    if (!this._cachedAddonBundles[type]) {
      let addonBundles = this._addonTreesFor(type);

      this._cachedAddonBundles[type] = addonBundles;
    }

    return this._cachedAddonBundles[type];
  }

  /*
   * @private
   * @method @createAddonTree
   */
  createAddonTree(type, outputDir, options) {
    let addonBundles = this._addonBundles(type, options);

    let tree = mergeTrees(
      addonBundles.map(({ tree }) => tree),
      {
        overwrite: true,
        annotation: `TreeMerger (${type})`,
      }
    );

    return new Funnel(tree, {
      destDir: outputDir,
      annotation: `Funnel: ${outputDir} ${type}`,
    });
  }

  addonTree() {
    if (!this._cachedAddonTree) {
      this._cachedAddonTree = this.createAddonTree('addon', 'addon-tree-output');
    }

    return this._cachedAddonTree;
  }

  addonTestSupportTree() {
    if (!this._cachedAddonTestSupportTree) {
      this._cachedAddonTestSupportTree = this.createAddonTree('addon-test-support', 'addon-test-support');
    }

    return this._cachedAddonTestSupportTree;
  }

  /*
   * Gather all dependencies external to `ember-cli`, namely:
   *
   * + app `vendor` files
   * + add-ons' `vendor` files
   * + node modules
   *
   * Resulting tree:
   *
   * ```
   * /
   * ├── addon-tree-output/
   * └── vendor/
   * ```
   *
   * @private
   * @method getExternalTree
   * @return {BroccoliTree}
   */
  getExternalTree() {
    if (!this._cachedExternalTree) {
      let vendorTrees = this.addonTreesFor('vendor');

      vendorTrees.push(this.trees.vendor);

      let vendor = this._defaultPackager.packageVendor(
        mergeTrees(vendorTrees, {
          overwrite: true,
          annotation: 'TreeMerger (vendor)',
        })
      );

      let addons = this.addonTree();
      let trees = [vendor].concat(addons);

      trees = this._nodeModuleTrees().concat(trees);

      this._cachedExternalTree = mergeTrees(trees, {
        annotation: 'TreeMerger (ExternalTree)',
        overwrite: true,
      });
    }

    return this._cachedExternalTree;
  }

  /*
   * Gather all tests under `tests` folder.
   *
   * Resulting tree:
   *
   * ```
   * /
   * └── tests/
   *     ├── acceptance/
   *     ├── addon-test-support/
   *     ├── helpers/
   *     ├── integration/
   *     ├── lint/
   *     ├── unit/
   *     ├── index.html
   *     └── test-helper.js
   * ```
   *
   * @private
   * @method getTests
   * @return {BroccoliTree}
   */
  getTests() {
    let addonTrees = this.addonTreesFor('test-support');

    if (this.hinting) {
      addonTrees.push(this.getLintTests());
    }

    let addonTestSupportFiles = this.addonTestSupportTree();
    let allTests = mergeTrees(addonTrees.concat(this.trees.tests, addonTestSupportFiles), {
      overwrite: true,
      annotation: 'TreeMerger (tests)',
    });

    return new Funnel(allTests, {
      destDir: 'tests',
    });
  }

  /*
   * Merges both application and add-ons public files and returns them in a
   * single tree.
   *
   * Given a tree:
   *
   * ```
   * ├── 500.html
   * ├── images
   * ├── maintenance.html
   * └── robots.txt
   * ```
   *
   * And add-on tree:
   *
   * ```
   * ember-fetch/
   * └── fastboot-fetch.js
   * ```
   *
   * Returns:
   *
   * ```
   * ├── 500.html
   * ├── ember-fetch
   * │   └── fastboot-fetch.js
   * ├── images
   * ├── maintenance.html
   * └── robots.txt
   * ```
   *
   * @private
   * @method getPublic
   * @return {BroccoliTree}
   */
  getPublic() {
    let addonPublicTrees = this.addonTreesFor('public');
    addonPublicTrees = addonPublicTrees.concat(this.trees.public);

    let mergedPublicTrees = mergeTrees(addonPublicTrees, {
      annotation: 'Public',
      overwrite: true,
    });

    return new Funnel(mergedPublicTrees, {
      destDir: 'public',
    });
  }

  /**
    Runs the `app`, `tests` and `templates` trees through the chain of addons that produces lint trees.

    Those lint trees are afterwards funneled into the `tests` folder, babel-ified and returned as an array.

    @private
    @method getLintTests
    @return {Array}
   */
  getLintTests() {
    let lintTrees = [];

    if (this.trees.app) {
      let lintedApp = this.addonLintTree('app', this.trees.app);
      lintedApp = new Funnel(lintedApp, {
        destDir: 'lint',
        annotation: 'Funnel (lint app)',
      });

      lintTrees.push(lintedApp);
    }

    let lintedTests = this.addonLintTree('tests', this.trees.tests);
    let lintedTemplates = this.addonLintTree('templates', this._templatesTree());

    lintedTests = new Funnel(lintedTests, {
      destDir: 'lint',
      annotation: 'Funnel (lint tests)',
    });

    lintedTemplates = new Funnel(lintedTemplates, {
      destDir: 'lint',
      annotation: 'Funnel (lint templates)',
    });

    return mergeTrees([lintedTests, lintedTemplates].concat(lintTrees), {
      overwrite: true,
    });
  }

  /**
    @public
    @method dependencies
    @return {Object} Alias to the project's dependencies function
  */
  dependencies(pkg) {
    return this.project.dependencies(pkg);
  }

  /**
    Imports an asset into the application.

    @public
    @method import
    @param {Object|String} asset Either a path to the asset or an object with environment names and paths as key-value pairs.
    @param {Object} [options] Options object
    @param {String} [options.type='vendor'] Either 'vendor' or 'test'
    @param {Boolean} [options.prepend=false] Whether or not this asset should be prepended
    @param {String} [options.destDir] Destination directory, defaults to the name of the directory the asset is in
    @param {String} [options.outputFile] Specifies the output file for given import. Defaults to assets/vendor.{js,css}
    @param {Array} [options.using] Specifies the array of transformations to be done on the asset. Can do an amd shim and/or custom transformation
    */
  import(asset, options) {
    let assetPath = this._getAssetPath(asset);

    if (!assetPath) {
      return;
    }

    options = defaultsDeep(options || {}, {
      type: 'vendor',
      prepend: false,
    });

    let match = assetPath.match(/^node_modules\/((@[^/]+\/)?[^/]+)\//);
    if (match !== null) {
      let basedir = options.resolveFrom || this.project.root;
      let name = match[1];
      let _path = path.dirname(resolve.sync(`${name}/package.json`, { basedir }));
      this._nodeModules.set(_path, { name, path: _path });
    }

    let directory = path.dirname(assetPath);
    let subdirectory = directory.replace(new RegExp(`^vendor/|node_modules/`), '');
    let extension = path.extname(assetPath);

    if (!extension) {
      throw new Error(
        'You must pass a file to `app.import`. For directories specify them to the constructor under the `trees` option.'
      );
    }

    this._import(assetPath, options, directory, subdirectory, extension);
  }

  /**
    @private
    @method _import
    @param {String} assetPath
    @param {Object} options
    @param {String} directory
    @param {String} subdirectory
    @param {String} extension
   */
  _import(assetPath, options, directory, subdirectory, extension) {
    // TODO: refactor, this has gotten very messy. Relevant tests: tests/unit/broccoli/ember-app-test.js
    let basename = path.basename(assetPath);

    if (p.isType(assetPath, 'js', { registry: this.registry })) {
      if (options.using) {
        if (!Array.isArray(options.using)) {
          throw new Error('You must pass an array of transformations for `using` option');
        }
        options.using.forEach((entry) => {
          if (!entry.transformation) {
            throw new Error(
              `while importing ${assetPath}: each entry in the \`using\` list must have a \`transformation\` name`
            );
          }

          let transformName = entry.transformation;

          if (!this._customTransformsMap.has(transformName)) {
            let availableTransformNames = Array.from(this._customTransformsMap.keys()).join(',');
            throw new Error(
              `while import ${assetPath}: found an unknown transformation name ${transformName}. Available transformNames are: ${availableTransformNames}`
            );
          }

          // process options for the transform and update the options
          let customTransforms = this._customTransformsMap.get(transformName);
          customTransforms.options = customTransforms.processOptions(assetPath, entry, customTransforms.options);
          customTransforms.files.push(assetPath);
        });
      }

      if (options.type === 'vendor') {
        options.outputFile = options.outputFile || this.options.outputPaths.vendor.js;
        addOutputFile('firstOneWins', this._scriptOutputFiles, assetPath, options);
      } else if (options.type === 'test') {
        if (!allowImport('firstOneWins', this.legacyTestFilesToAppend, assetPath, options)) {
          return;
        }
        if (options.prepend) {
          this.legacyTestFilesToAppend.unshift(assetPath);
        } else {
          this.legacyTestFilesToAppend.push(assetPath);
        }
      } else {
        throw new Error(
          `You must pass either \`vendor\` or \`test\` for options.type in your call to \`app.import\` for file: ${basename}`
        );
      }
    } else if (extension === '.css') {
      if (options.type === 'vendor') {
        options.outputFile = options.outputFile || this.options.outputPaths.vendor.css;
        addOutputFile('lastOneWins', this._styleOutputFiles, assetPath, options);
      } else {
        if (!allowImport('lastOneWins', this.vendorTestStaticStyles, assetPath, options)) {
          return;
        }
        if (options.prepend) {
          this.vendorTestStaticStyles.unshift(assetPath);
        } else {
          this.vendorTestStaticStyles.push(assetPath);
        }
      }
    } else {
      let destDir = options.destDir;
      if (destDir === '') {
        destDir = '/';
      }
      this.otherAssetPaths.push({
        src: directory,
        file: basename,
        dest: destDir || subdirectory,
      });
    }
  }

  /**
    @private
    @method _getAssetPath
    @param {(Object|String)} asset
    @return {(String|undefined)} assetPath
   */
  _getAssetPath(asset) {
    /* @type {String} */
    let assetPath;

    if (typeof asset !== 'object') {
      assetPath = asset;
    } else if (this.env in asset) {
      assetPath = asset[this.env];
    } else {
      assetPath = asset.development;
    }

    if (!assetPath) {
      return;
    }

    assetPath = assetPath.split('\\').join('/');

    if (assetPath.split('/').length < 2) {
      console.log(
        chalk.red(
          `Using \`app.import\` with a file in the root of \`vendor/\` causes a significant performance penalty. Please move \`${assetPath}\` into a subdirectory.`
        )
      );
    }

    if (/[*,]/.test(assetPath)) {
      throw new Error(
        `You must pass a file path (without glob pattern) to \`app.import\`.  path was: \`${assetPath}\``
      );
    }

    return assetPath;
  }

  /**
    Returns an array of trees for this application

    @private
    @method toArray
    @return {Array} An array of trees
   */
  toArray() {
    return [
      this.getAddonTemplates(),
      this.getStyles(),
      this.getTests(),
      this.getExternalTree(),
      this.getPublic(),
      this.getAppJavascript(),
    ].filter(Boolean);
  }

  _legacyPackage(fullTree) {
    let javascriptTree = this._defaultPackager.packageJavascript(fullTree);
    let stylesTree = this._defaultPackager.packageStyles(fullTree);
    let appIndex = this._defaultPackager.processIndex(fullTree);
    let additionalAssets = this._defaultPackager.importAdditionalAssets(fullTree);
    let publicTree = this._defaultPackager.packagePublic(fullTree);

    let sourceTrees = [appIndex, javascriptTree, stylesTree, additionalAssets, publicTree].filter(Boolean);

    if (this.tests && this.trees.tests) {
      sourceTrees.push(this._defaultPackager.packageTests(fullTree));
    }

    return mergeTrees(sourceTrees, {
      overwrite: true,
      annotation: 'Application Dist',
    });
  }

  /**
    Returns the merged tree for this application

    @public
    @method toTree
    @param  {Array} [additionalTrees] Array of additional trees to merge
    @return {Tree}                  Merged tree for this application
   */
  toTree(additionalTrees) {
    let packagedTree;

    let fullTree = mergeTrees(this.toArray(), {
      overwrite: true,
      annotation: 'Full Application',
    });

    fullTree = this._debugTree(fullTree, 'prepackage');

    if (!packagedTree) {
      packagedTree = this._legacyPackage(fullTree);
    }

    let trees = [].concat(packagedTree, additionalTrees).filter(Boolean);
    let combinedPackageTree = broccoliMergeTrees(trees);

    return this.addonPostprocessTree('all', combinedPackageTree);
  }
}

module.exports = EmberApp;

function addOutputFile(strategy, container, assetPath, options) {
  let outputFile = options.outputFile;

  if (!outputFile) {
    throw new Error('outputFile is not specified');
  }

  if (!container[outputFile]) {
    container[outputFile] = [];
  }
  if (!allowImport(strategy, container[outputFile], assetPath, options)) {
    return;
  }

  if (options.prepend) {
    container[outputFile].unshift(assetPath);
  } else {
    container[outputFile].push(assetPath);
  }
}

// In this strategy the last instance of the asset in the array is the one which will be used.
// This applies to CSS where the last asset always "wins" no matter what.
function _lastOneWins(fileList, assetPath, options) {
  let assetIndex = fileList.indexOf(assetPath);

  // Doesn't exist in the current fileList. Safe to remove.
  if (assetIndex === -1) {
    return true;
  }

  logger.info(`Highlander Rule: duplicate \`app.import(${assetPath})\`. Only including the last by order.`);

  if (options.prepend) {
    // The existing asset is _already after_ this inclusion and would win.
    // Therefore this branch is a no-op.
    return false;
  } else {
    // The existing asset is _before_ this inclusion and needs to be removed.
    fileList.splice(fileList.indexOf(assetPath), 1);
    return true;
  }
}

// In JS the asset which would be first will win.
// If it is something which includes globals we want those defined as early as
// possible. Any initialization would likely be repeated. Any mutation of global
// state that occurs on initialization is likely _fixed_.
// Any module definitions will be identical except in the scenario where they'red
// reified to reassignment. This is likely fine.
function _firstOneWins(fileList, assetPath, options) {
  let assetIndex = fileList.indexOf(assetPath);

  // Doesn't exist in the current fileList. Safe to remove.
  if (assetIndex === -1) {
    return true;
  }

  logger.info(`Highlander Rule: duplicate \`app.import(${assetPath})\`. Only including the first by order.`);

  if (options.prepend) {
    // The existing asset is _after_ this inclusion and needs to be removed.
    fileList.splice(fileList.indexOf(assetPath), 1);
    return true;
  } else {
    // The existing asset is _already before_ this inclusion and would win.
    // Therefore this branch is a no-op.
    return false;
  }
}

function allowImport(strategy, fileList, assetPath, options) {
  if (strategy === 'firstOneWins') {
    // We must find all occurrences and decide what to do with each.
    return _firstOneWins.call(undefined, fileList, assetPath, options);
  } else if (strategy === 'lastOneWins') {
    // We can simply use the "last one wins" strategy.
    return _lastOneWins.call(undefined, fileList, assetPath, options);
  } else {
    return true;
  }
}

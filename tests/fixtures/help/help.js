const processHelpString = require('../../helpers/process-help-string');
const versionUtils      = require('../../../lib/utilities/version-utils');
var emberCLIVersion   = versionUtils.emberCLIVersion;

module.exports = {
  name: 'ember',
  description: null,
  aliases: [],
  works: 'insideProject',
  availableOptions: [],
  anonymousOptions: ['<command (Default: help)>'],
  version: emberCLIVersion(),
  commands: [
    {
      name: 'addon',
      description: 'Generates a new folder structure for building an addon, complete with test harness.',
      aliases: [],
      works: 'everywhere',
      availableOptions: [
        {
          name: 'dry-run',
          default: false,
          aliases: ['d'],
          key: 'dryRun',
          required: false
        },
        {
          name: 'verbose',
          default: false,
          aliases: ['v'],
          key: 'verbose',
          required: false
        },
        {
          name: 'blueprint',
          default: 'addon',
          aliases: ['b'],
          key: 'blueprint',
          required: false
        },
        {
          name: 'skip-npm',
          default: false,
          aliases: ['sn', 'skip-install', 'si'],
          key: 'skipNpm',
          required: false
        },
        {
          name: 'skip-git',
          default: false,
          aliases: ['sg'],
          key: 'skipGit',
          required: false
        },
        {
          aliases: [{ npm: 'npm' }, { pnpm: 'pnpm' }, { yarn: 'yarn' }],
          key: 'packageManager',
          name: 'package-manager',
          required: false,
          type: ['npm', 'pnpm', 'yarn'],
        },
        {
          name: 'directory',
          aliases: ['dir'],
          key: 'directory',
          required: false
        },
        {
          name: 'lang',
          key: 'lang',
          description: "Sets the base human language of the addon's own test application via index.html",
          required: false
        },
        {
          name: 'ci-provider',
          key: 'ciProvider',
          type: ['travis', 'github', 'none'],
          default: 'github',
          description: 'Installs the optional default CI blueprint. Either Travis or Github Actions is supported.',
          required: false
        },
        {
          default: false,
          key: 'typescript',
          name: 'typescript',
          description: 'Set up the addon to use TypeScript',
          required: false,
        },
      ],
      anonymousOptions: ['<addon-name>']
    },
    {
      name: 'asset-sizes',
      description: 'Shows the sizes of your asset files.',
      works: 'insideProject',
      aliases: [],
      anonymousOptions: [],
      availableOptions: [
        {
          name: 'output-path',
          default: 'dist/',
          key: 'outputPath',
          required: false,
          aliases: ['o'],
          type: 'Path'
        },
        {
          default: false,
          key: 'json',
          name: 'json',
          required: false
        }
      ]
    },
    {
      name: 'build',
      description: 'Builds your app and places it into the output path (dist/ by default).',
      aliases: ['b'],
      works: 'insideProject',
      availableOptions: [
        {
          name: 'environment',
          description: 'Possible values are "development", "production", and "test".',
          default: 'development',
          aliases: [
            'e',
            { dev: 'development' },
            { prod: 'production' }
          ],
          key: 'environment',
          required: false
        },
        {
          name: 'output-path',
          default: 'dist/',
          aliases: ['o'],
          key: 'outputPath',
          required: false,
          type: 'Path'
        },
        {
          name: 'watch',
          default: false,
          aliases: ['w'],
          key: 'watch',
          required: false
        },
        {
          name: 'watcher',
          key: 'watcher',
          required: false
        },
        {
          name: 'suppress-sizes',
          default: false,
          key: 'suppressSizes',
          required: false
        }
      ],
      anonymousOptions: []
    },
    {
      name: 'destroy',
      description: 'Destroys code generated by `generate` command.',
      aliases: ['d'],
      works: 'insideProject',
      availableOptions: [
        {
          name: 'dry-run',
          default: false,
          aliases: ['d'],
          key: 'dryRun',
          required: false
        },
        {
          name: 'verbose',
          default: false,
          aliases: ['v'],
          key: 'verbose',
          required: false
        },
        {
          name: 'pod',
          default: false,
          aliases: ['p', 'pods'],
          key: 'pod',
          required: false
        },
        {
          name: 'classic',
          default: false,
          aliases: ['c'],
          key: 'classic',
          required: false
        },
        {
          name: 'dummy',
          default: false,
          aliases: ['dum', 'id'],
          key: 'dummy',
          required: false
        },
        {
          name: 'in-repo-addon',
          default: null,
          aliases: ['in-repo', 'ir'],
          key: 'inRepoAddon',
          required: false
        },
        {
          name: 'in',
          default: null,
          description: 'Runs a blueprint against an in repo addon. A path is expected, relative to the root of the project.',
          key: 'in',
          required: false
        },
        {
          name: 'typescript',
          aliases: ['ts'],
          description: 'Specifically destroys the TypeScript output of the `generate` command. Run `--no-typescript` to instead target the JavaScript output.',
          key: 'typescript',
          required: false
        }
      ],
      anonymousOptions: ['<blueprint>']
    },
    {
      name: 'generate',
      description: 'Generates new code from blueprints.',
      aliases: ['g'],
      works: 'insideProject',
      availableOptions: [
        {
          name: 'dry-run',
          default: false,
          aliases: ['d'],
          key: 'dryRun',
          required: false
        },
        {
          name: 'verbose',
          default: false,
          aliases: ['v'],
          key: 'verbose',
          required: false
        },
        {
          name: 'pod',
          default: false,
          aliases: ['p', 'pods'],
          key: 'pod',
          required: false
        },
        {
          name: 'classic',
          default: false,
          aliases: ['c'],
          key: 'classic',
          required: false
        },
        {
          name: 'dummy',
          default: false,
          aliases: ['dum', 'id'],
          key: 'dummy',
          required: false
        },
        {
          name: 'in-repo-addon',
          default: null,
          aliases: ['in-repo', 'ir'],
          key: 'inRepoAddon',
          required: false
        },
        {
          name: 'lint-fix',
          default: true,
          key: 'lintFix',
          required: false
        },
        {
          name: 'in',
          default: null,
          description: 'Runs a blueprint against an in repo addon. A path is expected, relative to the root of the project.',
          key: 'in',
          required: false
        },
        {
          name: 'typescript',
          aliases: ['ts'],
          description: 'Generates a version of the blueprint written in TypeScript (if available).',
          key: 'typescript',
          required: false
        }
      ],
      anonymousOptions: ['<blueprint>'],
      availableBlueprints: [
        {
          'ember-cli': [
            {
              name: 'addon',
              description: 'The default blueprint for ember-cli addons.',
              availableOptions: [],
              anonymousOptions: ['name'],
              overridden: false
            },
            {
              name: 'addon-import',
              description: 'Generates an import wrapper.',
              availableOptions: [],
              anonymousOptions: ['name'],
              overridden: false
            },
            {
              name: 'app',
              description: 'The default blueprint for ember-cli projects.',
              availableOptions: [],
              anonymousOptions: ['name'],
              overridden: false
            },
            {
              name: 'blueprint',
              description: 'Generates a blueprint and definition.',
              availableOptions: [],
              anonymousOptions: ['name'],
              overridden: false
            },
            {
              name: 'http-mock',
              description: 'Generates a mock api endpoint in /api prefix.',
              availableOptions: [],
              anonymousOptions: ['endpoint-path'],
              overridden: false
            },
            {
              name: 'http-proxy',
              description: 'Generates a relative proxy to another server.',
              availableOptions: [],
              anonymousOptions: ['local-path', 'remote-url'],
              overridden: false
            },
            {
              name: 'in-repo-addon',
              description: 'The blueprint for addon in repo ember-cli addons.',
              availableOptions: [],
              anonymousOptions: ['name'],
              overridden: false
            },
            {
              name: 'lib',
              description: 'Generates a lib directory for in-repo addons.',
              availableOptions: [],
              anonymousOptions: ['name'],
              overridden: false
            },
            {
              name: 'server',
              description: 'Generates a server directory for mocks and proxies.',
              availableOptions: [],
              anonymousOptions: ['name'],
              overridden: false
            }
          ]
        }
      ]
    },
    {
      name: 'help',
      description: 'Outputs the usage instructions for all commands or the provided command',
      aliases: [null, 'h', '--help', '-h'],
      works: 'everywhere',
      availableOptions: [
        {
          name: 'verbose',
          default: false,
          aliases: ['v'],
          key: 'verbose',
          required: false
        },
        {
          name: 'json',
          default: false,
          key: 'json',
          required: false
        }
      ],
      anonymousOptions: ['<command-name (Default: all)>']
    },
    {
      name: 'init',
      description: 'Reinitializes a new ember-cli project in the current folder.',
      aliases: [],
      works: 'everywhere',
      availableOptions: [
        {
          name: 'dry-run',
          default: false,
          aliases: ['d'],
          key: 'dryRun',
          required: false
        },
        {
          name: 'verbose',
          default: false,
          aliases: ['v'],
          key: 'verbose',
          required: false
        },
        {
          name: 'blueprint',
          aliases: ['b'],
          key: 'blueprint',
          required: false
        },
        {
          name: 'skip-npm',
          default: false,
          aliases: ['sn', 'skip-install', 'si'],
          key: 'skipNpm',
          required: false
        },
        {
          name: 'lint-fix',
          default: true,
          key: 'lintFix',
          required: false
        },
        {
          name: 'welcome',
          key: 'welcome',
          description: 'Installs and uses {{ember-welcome-page}}. Use --no-welcome to skip it.',
          default: true,
          required: false
        },
        {
          aliases: [{ npm: 'npm' }, { pnpm: 'pnpm' }, { yarn: 'yarn' }],
          key: 'packageManager',
          name: 'package-manager',
          required: false,
          type: ['npm', 'pnpm', 'yarn'],
        },
        {
          name: 'name',
          default: '',
          aliases: ['n'],
          key: 'name',
          required: false
        },
        {
          name: 'lang',
          key: 'lang',
          description: 'Sets the base human language of the application via index.html',
          required: false
        },
        {
          default: false,
          key: 'embroider',
          name: 'embroider',
          description: 'Enables the build system to use Embroider',
          required: false,
        },
        {
          name: 'ci-provider',
          key: 'ciProvider',
          type: ['travis', 'github', 'none'],
          default: 'github',
          description: 'Installs the optional default CI blueprint. Either Travis or Github Actions is supported.',
          required: false,
        },
        {
          default: false,
          key: 'typescript',
          name: 'typescript',
          description: 'Set up the app to use TypeScript',
          required: false,
        },
      ],
      anonymousOptions: ['<glob-pattern>']
    },
    {
      name: 'install',
      description: 'Installs an ember-cli addon from npm.',
      aliases: ['i'],
      works: 'insideProject',
      availableOptions: [
        {
          name: 'save',
          default: false,
          aliases: ['S'],
          key: 'save',
          required: false
        },
        {
          name: 'save-dev',
          default: true,
          aliases: ['D'],
          key: 'saveDev',
          required: false
        },
        {
          name: 'save-exact',
          default: false,
          aliases: ['E', 'exact'],
          key: 'saveExact',
          required: false
        },
        {
          aliases: [{ npm: 'npm' }, { pnpm: 'pnpm' }, { yarn: 'yarn' }],
          description:
            'Use this option to force the usage of a specific package manager. By default, ember-cli will try to detect the right package manager from any lockfiles that exist in your project.',
          key: 'packageManager',
          name: 'package-manager',
          required: false,
          type: ['npm', 'pnpm', 'yarn'],
        },
      ],
      anonymousOptions: ['<addon-name>']
    },
    {
      name: 'new',
      description: processHelpString('Creates a new directory and runs \u001b[32member init\u001b[39m in it.'),
      aliases: [],
      works: 'everywhere',
      availableOptions: [
        {
          name: 'dry-run',
          default: false,
          aliases: ['d'],
          key: 'dryRun',
          required: false
        },
        {
          name: 'verbose',
          default: false,
          aliases: ['v'],
          key: 'verbose',
          required: false
        },
        {
          name: 'blueprint',
          default: 'app',
          aliases: ['b'],
          key: 'blueprint',
          required: false
        },
        {
          name: 'skip-npm',
          default: false,
          aliases: ['sn', 'skip-install', 'si'],
          key: 'skipNpm',
          required: false
        },
        {
          name: 'skip-git',
          default: false,
          aliases: ['sg'],
          key: 'skipGit',
          required: false
        },
        {
          name: 'welcome',
          key: 'welcome',
          description: 'Installs and uses {{ember-welcome-page}}. Use --no-welcome to skip it.',
          default: true,
          required: false
        },
        {
          aliases: [{ npm: 'npm' }, { pnpm: 'pnpm' }, { yarn: 'yarn' }],
          key: 'packageManager',
          name: 'package-manager',
          required: false,
          type: ['npm', 'pnpm', 'yarn'],
        },
        {
          name: 'directory',
          aliases: ['dir'],
          key: 'directory',
          required: false
        },
        {
          name: 'lang',
          key: 'lang',
          description: 'Sets the base human language of the application via index.html',
          required: false
        },
        {
          default: false,
          key: 'embroider',
          name: 'embroider',
          description: 'Enables the build system to use Embroider',
          required: false,
        },
        {
          name: 'ci-provider',
          key: 'ciProvider',
          type: ['travis', 'github', 'none'],
          description: 'Installs the optional default CI blueprint. Either Travis or Github Actions is supported.',
          required: false,
        },
        {
          name: 'interactive',
          default: false,
          aliases: ['i'],
          description: 'Create a new Ember app/addon in an interactive way.',
          key: 'interactive',
          required: false,
        },
        {
          default: false,
          key: 'typescript',
          name: 'typescript',
          description: 'Set up the app to use TypeScript',
          required: false,
        },
      ],
      anonymousOptions: ['<app-name>']
    },
    {
      name: 'serve',
      description: 'Builds and serves your app, rebuilding on file changes.',
      aliases: ['server', 's'],
      works: 'insideProject',
      availableOptions: [
        {
          name: 'port',
          default: 4200,
          description: 'Overrides $PORT (currently blank). If the port 0 or the default port 4200 is passed, ember will use any available port starting from 4200.',
          aliases: ['p'],
          key: 'port',
          required: false
        },
        {
          name: 'host',
          description: 'Listens on all interfaces by default',
          aliases: ['H'],
          key: 'host',
          required: false
        },
        {
          name: 'proxy',
          aliases: ['pr', 'pxy'],
          key: 'proxy',
          required: false
        },
        {
          name: 'proxy-in-timeout',
          default: 120000,
          description: 'When using --proxy: timeout (in ms) for incoming requests',
          aliases: ['pit'],
          key: 'proxyInTimeout',
          required: false
        },
        {
          name: 'proxy-out-timeout',
          default: 0,
          description: 'When using --proxy: timeout (in ms) for outgoing requests',
          aliases: ['pot'],
          key: 'proxyOutTimeout',
          required: false
        },
        {
          name: 'secure-proxy',
          default: true,
          description: 'Set to false to proxy self-signed SSL certificates',
          aliases: ['spr'],
          key: 'secureProxy',
          required: false
        },
        {
          name: 'transparent-proxy',
          default: true,
          description: 'Set to false to omit x-forwarded-* headers when proxying',
          aliases: ['transp'],
          key: 'transparentProxy',
          required: false
        },
        {
          name: 'watcher',
          default: 'events',
          aliases: ['w'],
          key: 'watcher',
          required: false
        },
        {
          name: 'live-reload',
          default: true,
          aliases: ['lr'],
          key: 'liveReload',
          required: false
        },
        {
          name: 'live-reload-host',
          description: 'Defaults to host',
          aliases: ['lrh'],
          key: 'liveReloadHost',
          required: false
        },
        {
          aliases: ['lrbu'],
          description: 'Defaults to rootURL',
          key: 'liveReloadBaseUrl',
          name: 'live-reload-base-url',
          required: false
        },
        {
          name: 'live-reload-port',
          description: 'Defaults to same port as ember app',
          aliases: ['lrp'],
          key: 'liveReloadPort',
          required: false
        },
        {
          name: 'live-reload-prefix',
          default: '_lr',
          description: 'Default to _lr',
          aliases: ['lrprefix'],
          key: 'liveReloadPrefix',
          required: false
        },
        {
          name: 'environment',
          description: 'Possible values are "development", "production", and "test".',
          default: 'development',
          aliases: [
            'e',
            { dev: 'development' },
            { prod: 'production' }
          ],
          key: 'environment',
          required: false
        },
        {
          name: 'output-path',
          default: 'dist/',
          aliases: ['op', 'out'],
          key: 'outputPath',
          required: false,
          type: 'Path',
        },
        {
          name: 'ssl',
          default: false,
          description: 'Set to true to configure Ember CLI to serve using SSL.',
          key: 'ssl',
          required: false
        },
        {
          name: 'ssl-key',
          default: 'ssl/server.key',
          description: 'Specify the private key to use for SSL.',
          key: 'sslKey',
          required: false
        },
        {
          name: 'ssl-cert',
          default: 'ssl/server.crt',
          description: 'Specify the certificate to use for SSL.',
          key: 'sslCert',
          required: false
        },
        {
          name: 'path',
          description: 'Reuse an existing build at given path.',
          key: 'path',
          required: false,
          type: 'Path'
        }
      ],
      anonymousOptions: []
    },
    {
      name: 'test',
      description: 'Runs your app\'s test suite.',
      aliases: ['t'],
      works: 'insideProject',
      availableOptions: [
        {
          name: 'environment',
          description: 'Possible values are "development", "production", and "test".',
          default: 'test',
          aliases: ['e'],
          key: 'environment',
          required: false
        },
        {
          name: 'config-file',
          aliases: ['c', 'cf'],
          key: 'configFile',
          required: false
        },
        {
          name: 'server',
          default: false,
          aliases: ['s'],
          key: 'server',
          required: false
        },
        {
          name: 'host',
          aliases: ['H'],
          key: 'host',
          required: false
        },
        {
          name: 'test-port',
          default: 7357,
          description: 'The test port to use when running tests. Pass 0 to automatically pick an available port',
          aliases: ['tp'],
          key: 'testPort',
          required: false
        },
        {
          name: 'filter',
          description: 'A string to filter tests to run',
          aliases: ['f'],
          key: 'filter',
          required: false
        },
        {
          name: 'module',
          description: 'The name of a test module to run',
          aliases: ['m'],
          key: 'module',
          required: false
        },
        {
          name: 'watcher',
          default: 'events',
          aliases: ['w'],
          key: 'watcher',
          required: false
        },
        {
          name: 'launch',
          default: false,
          description: 'A comma separated list of browsers to launch for tests.',
          key: 'launch',
          required: false
        },
        {
          name: 'reporter',
          description: 'Test reporter to use [tap|dot|xunit] (default: tap)',
          aliases: ['r'],
          key: 'reporter',
          required: false
        },
        {
          name: 'silent',
          default: false,
          description: 'Suppress any output except for the test report',
          key: 'silent',
          required: false
        },
        {
          name: 'ssl',
          default: false,
          description: 'Set to true to configure testem to run the test suite using SSL.',
          key: 'ssl',
          required: false
        },
        {
          name: 'ssl-key',
          default: 'ssl/server.key',
          description: 'Specify the private key to use for SSL.',
          key: 'sslKey',
          required: false
        },
        {
          name: 'ssl-cert',
          default: 'ssl/server.crt',
          description: 'Specify the certificate to use for SSL.',
          key: 'sslCert',
          required: false
        },
        {
          name: 'testem-debug',
          description: 'File to write a debug log from testem',
          key: 'testemDebug',
          required: false
        },
        {
          name: 'test-page',
          description: 'Test page to invoke',
          key: 'testPage',
          required: false
        },
        {
          name: 'path',
          description: 'Reuse an existing build at given path.',
          key: 'path',
          required: false,
          type: 'Path',
        },
        {
          name: 'query',
          description: 'A query string to append to the test page URL.',
          key: 'query',
          required: false
        },
        {
          name: 'output-path',
          aliases: ['o'],
          key: 'outputPath',
          required: false,
          type: 'Path'
        }
      ],
      anonymousOptions: []
    },
    {
      name: 'version',
      description: 'outputs ember-cli version',
      aliases: ['v', '--version', '-v'],
      works: 'everywhere',
      availableOptions: [
        {
          name: 'verbose',
          default: false,
          key: 'verbose',
          required: false
        }
      ],
      anonymousOptions: []
    }
  ],
  addons: []
};

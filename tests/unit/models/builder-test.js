'use strict';

const fs = require('fs-extra');
const path = require('path');
const BuildCommand = require('../../../lib/commands/build');
const commandOptions = require('../../factories/command-options');
const fixturify = require('fixturify');
const MockProject = require('../../helpers/mock-project');
const td = require('testdouble');
const { expect } = require('chai');
const { file } = require('chai-files');
const tmp = require('tmp-promise');

let Builder;

describe('models/builder.js', function () {
  let addon, builder, buildResults, tmpdir;

  async function setupBroccoliBuilder() {
    this.builder = {
      outputPath: 'build results',
      outputNodeWrapper: {
        __heimdall__: {},
      },
      build() {
        return Promise.resolve({
          outputPath: 'build results',
          outputNodeWrapper: {
            __heimdall__: {},
          },
        });
      },
      cleanup() {},
    };
  }

  before(function () {
    let willInterruptProcess = require('../../../lib/utilities/will-interrupt-process');
    td.replace(willInterruptProcess, 'addHandler', td.function());
    td.replace(willInterruptProcess, 'removeHandler', td.function());

    Builder = require('../../../lib/models/builder');
  });

  afterEach(function () {
    if (builder) {
      return builder.cleanup();
    }
  });

  describe('copyToOutputPath', function () {
    beforeEach(async function () {
      const { path } = await tmp.dir();
      tmpdir = path;
      let project = new MockProject();
      builder = new Builder({
        project,
        ui: project.ui,
        setupBroccoliBuilder,
      });
    });

    it('allows for non-existent output-paths at arbitrary depth', function () {
      builder.outputPath = path.join(tmpdir, 'some', 'path', 'that', 'does', 'not', 'exist');

      builder.copyToOutputPath('tests/fixtures/blueprints/basic_2');
      expect(file(path.join(builder.outputPath, 'files', 'foo.txt'))).to.exist;
    });

    describe('build command', function () {
      let command;
      let parentPath = `..${path.sep}..${path.sep}`;

      beforeEach(function () {
        command = new BuildCommand(commandOptions());

        let project = new MockProject();
        builder = new Builder({
          project,
          ui: project.ui,
          setupBroccoliBuilder,
        });
      });

      it('when outputPath is root directory ie., `--output-path=/` or `--output-path=C:`', function () {
        let outputPathArg = '--output-path=.';
        let outputPath = command.parseArgs([outputPathArg]).options.outputPath;
        outputPath = outputPath.split(path.sep)[0] + path.sep;
        builder.outputPath = outputPath;

        expect(builder.canDeleteOutputPath(outputPath)).to.equal(false);
      });

      it('when outputPath is project root ie., `--output-path=.`', function () {
        let outputPathArg = '--output-path=.';
        let outputPath = command.parseArgs([outputPathArg]).options.outputPath;
        builder.outputPath = outputPath;

        expect(builder.canDeleteOutputPath(outputPath)).to.equal(false);
      });

      it(`when outputPath is a parent directory ie., \`--output-path=${parentPath}\``, function () {
        let outputPathArg = `--output-path=${parentPath}`;
        let outputPath = command.parseArgs([outputPathArg]).options.outputPath;
        builder.outputPath = outputPath;

        expect(builder.canDeleteOutputPath(outputPath)).to.equal(false);
      });

      it('allow outputPath to contain the root path as a substring, as long as it is not a parent', function () {
        let outputPathArg = '--output-path=.';
        let outputPath = command.parseArgs([outputPathArg]).options.outputPath;
        outputPath = outputPath.substr(0, outputPath.length - 1);
        builder.outputPath = outputPath;

        expect(builder.canDeleteOutputPath(outputPath)).to.equal(true);
      });
    });
  });

  describe('build', function () {
    let instrumentationStart;
    let instrumentationStop;
    let cwd, project;

    beforeEach(function () {
      // Cache cwd to reset after test
      cwd = process.cwd();
      project = new MockProject();
      builder = new Builder({
        project,
        ui: project.ui,
        setupBroccoliBuilder,
        copyToOutputPath() {
          return [];
        },
      });

      instrumentationStart = td.replace(builder.project._instrumentation, 'start');
      instrumentationStop = td.replace(builder.project._instrumentation, 'stopAndReport');
    });

    afterEach(function () {
      process.chdir(cwd);
      delete process._heimdall;
      delete process.env.BROCCOLI_VIZ;
      builder.project.ui.output = '';
      if (fs.existsSync(`${builder.project.root}/tmp`)) {
        fs.removeSync(`${builder.project.root}/tmp`);
      }
    });

    it('calls instrumentation.start', async function () {
      let mockAnnotation = 'MockAnnotation';
      await builder.build(null, mockAnnotation);
      td.verify(instrumentationStart('build'), { times: 1 });
    });

    it('calls instrumentation.stop(build, result, resultAnnotation)', async function () {
      let mockAnnotation = 'MockAnnotation';

      await builder.build(null, mockAnnotation);

      td.verify(
        instrumentationStop('build', { directory: 'build results', graph: { __heimdall__: {} } }, mockAnnotation),
        { times: 1 }
      );
    });

    it('writes temp files to Broccoli temp dir', async function () {
      const project = new MockProject();
      project.root += '/tests/fixtures/build/simple';
      expect(fs.existsSync(`${builder.project.root}/tmp`)).to.be.false;
      builder = new Builder({
        project,
        ui: project.ui,
        copyToOutputPath() {
          return [];
        },
      });

      expect(fs.existsSync(`${builder.project.root}/tmp`)).to.be.false;

      let result = await builder.build();
      expect(fs.existsSync(result.directory)).to.be.true;
      expect(fs.existsSync(`${builder.project.root}/tmp`)).to.be.false;
      fs.removeSync(result.directory);
    });

    it('produces the correct output', async function () {
      const project = new MockProject();
      project.root += '/tests/fixtures/build/simple';
      const setup = () =>
        new Builder({
          project,
          ui: project.ui,
          copyToOutputPath() {
            return [];
          },
        });

      let result = await setup().build();

      expect(fixturify.readSync(result.directory)).to.deep.equal(fixturify.readSync(`${project.root}/dist`));
    });

    // packages using node's module support (via type=module) need to have
    // ember-cli-build.cjs rather than ember-cli.js in order for require to
    // work correctly
    it('builds packages using ESM', async function () {
      const project = new MockProject();
      project.root += '/tests/fixtures/build/node-esm';
      const setupBuilder = () =>
        new Builder({
          project,
          ui: project.ui,
          copyToOutputPath() {
            return [];
          },
        });

      let result = await setupBuilder().build();

      expect(fixturify.readSync(result.directory)).to.deep.equal(fixturify.readSync(`${project.root}/dist`));
    });

    it('returns {directory, graph} as the result object', async function () {
      const project = new MockProject();
      project.root += '/tests/fixtures/build/simple';

      builder = new Builder({
        project,
        ui: project.ui,
        copyToOutputPath() {
          return [];
        },
      });

      let result = await builder.build();

      expect(Object.keys(result)).to.eql(['directory', 'graph']);
      expect(result.graph.__heimdall__).to.not.be.undefined;
      expect(fs.existsSync(result.directory)).to.be.true;
    });
  });

  describe('cleanup', function () {
    beforeEach(function () {
      let project = new MockProject();
      builder = new Builder({
        project,
        ui: project.ui,
        setupBroccoliBuilder,
        copyToOutputPath() {
          return [];
        },
      });
    });

    it('is idempotent', async function () {
      await builder.build();

      let cleanupCount = 0;
      builder.builder.cleanup = function () {
        cleanupCount++;
      };

      let cleanupPromises = [builder.cleanup(), builder.cleanup(), builder.cleanup(), builder.cleanup()];

      await Promise.all(cleanupPromises);

      expect(cleanupCount).to.equal(1);
    });
  });

  describe('addons', function () {
    let hooksCalled;

    beforeEach(function () {
      hooksCalled = [];
      addon = {
        name: 'TestAddon',
        preBuild() {
          hooksCalled.push('preBuild');
          expect(this).to.equal(addon);

          return Promise.resolve();
        },

        postBuild() {
          hooksCalled.push('postBuild');

          return Promise.resolve();
        },

        outputReady() {
          hooksCalled.push('outputReady');
        },

        buildError() {
          hooksCalled.push('buildError');
        },
      };

      let project = new MockProject();
      project.addons = [addon];

      builder = new Builder({
        async setupBroccoliBuilder() {
          await setupBroccoliBuilder.call(this);
          let originalBuild = this.builder.build;
          this.builder.build = () => {
            hooksCalled.push('build');
            return originalBuild.call(this);
          };
        },
        copyToOutputPath() {
          return [];
        },
        project,
        ui: project.ui,
      });

      buildResults = {
        directory: 'build results',
        graph: {
          __heimdall__: {},
        },
      };
    });

    afterEach(function () {
      delete process.env.BROCCOLI_VIZ;
      delete process.env.EMBER_CLI_INSTRUMENTATION;
    });

    it('allows addons to add promises preBuild', function () {
      let preBuild = td.replace(addon, 'preBuild', td.function());
      td.when(preBuild(), { ignoreExtraArgs: true, times: 1 }).thenReturn(Promise.resolve());

      return builder.build();
    });

    it('allows addons to add promises postBuild', async function () {
      let postBuild = td.replace(addon, 'postBuild', td.function());

      await builder.build();
      td.verify(postBuild(buildResults), { times: 1 });
    });

    it('allows addons to add promises outputReady', async function () {
      let outputReady = td.replace(addon, 'outputReady', td.function());

      builder.outputPath = 'dist/';
      await builder.build();

      let expected = Object.assign({}, buildResults, { outputChanges: [], directory: 'dist/' });
      td.verify(outputReady(expected), { times: 1 });
    });

    describe('instrumentation hooks', function () {
      beforeEach(function () {
        process.env.EMBER_CLI_INSTRUMENTATION = '1';
      });

      it('invokes the instrumentation hook if it is preset', async function () {
        addon.instrumentation = function () {
          hooksCalled.push('instrumentation');
        };

        await builder.build(null, {});
        expect(hooksCalled).to.deep.equal(['preBuild', 'build', 'postBuild', 'outputReady', 'instrumentation']);
      });
    });

    it('hooks are called in the right order without visualization', async function () {
      await builder.build();
      expect(hooksCalled).to.deep.equal(['preBuild', 'build', 'postBuild', 'outputReady']);
    });

    it('should call postBuild before copying to dist', async function () {
      let called = [];

      addon.postBuild = function () {
        called.push('postBuild');
      };

      builder.copyToOutputPath = function () {
        called.push('copyToOutputPath');
      };

      await builder.build();
      expect(called).to.deep.equal(['postBuild', 'copyToOutputPath']);
    });

    it('should call outputReady after copying to output path', async function () {
      let called = [];

      builder.copyToOutputPath = function (directory) {
        called.push(['copyToOutputPath', directory]);
        return [];
      };

      addon.outputReady = function (result) {
        called.push(['outputReady', result]);
      };

      builder.outputPath = 'dist/';

      await builder.build();

      expect(called).to.deep.equal([
        ['copyToOutputPath', buildResults.directory],
        ['outputReady', Object.assign({}, buildResults, { outputChanges: [], directory: 'dist/' })],
      ]);
    });

    it('buildError receives the error object from the errored step', async function () {
      let thrownBuildError = new Error('buildError');
      let receivedBuildError;

      addon.buildError = function (errorThrown) {
        receivedBuildError = errorThrown;
      };

      await builder.setupBroccoliBuilder();
      builder.builder.build = function () {
        hooksCalled.push('build');

        return Promise.reject(thrownBuildError);
      };

      await expect(builder.build()).to.be.rejected;
      expect(receivedBuildError).to.equal(thrownBuildError);
    });

    it('calls buildError and does not call build, postBuild or outputReady when preBuild fails', async function () {
      addon.preBuild = function () {
        hooksCalled.push('preBuild');

        return Promise.reject(new Error('preBuild Error'));
      };

      await expect(builder.build()).to.be.rejected;
      expect(hooksCalled).to.deep.equal(['preBuild', 'buildError']);
    });

    it('calls buildError and does not call postBuild or outputReady when build fails', async function () {
      await builder.setupBroccoliBuilder();
      builder.builder.build = function () {
        hooksCalled.push('build');

        return Promise.reject(new Error('build Error'));
      };

      await expect(builder.build()).to.be.rejected;
      expect(hooksCalled).to.deep.equal(['preBuild', 'build', 'buildError']);
    });

    it('calls buildError when postBuild fails', async function () {
      addon.postBuild = function () {
        hooksCalled.push('postBuild');

        return Promise.reject(new Error('preBuild Error'));
      };

      await expect(builder.build()).to.be.rejected;
      expect(hooksCalled).to.deep.equal(['preBuild', 'build', 'postBuild', 'buildError']);
    });

    it('calls buildError when outputReady fails', async function () {
      addon.outputReady = function () {
        hooksCalled.push('outputReady');

        return Promise.reject(new Error('outputReady Error'));
      };

      await expect(builder.build()).to.be.rejected;
      expect(hooksCalled).to.deep.equal(['preBuild', 'build', 'postBuild', 'outputReady', 'buildError']);
    });

    it('sets `isBuilderError` on handled addon errors', async function () {
      addon.postBuild = function () {
        return Promise.reject(new Error('preBuild Error'));
      };

      let error;
      try {
        await builder.build();
      } catch (e) {
        error = e;
      }
      expect(error).to.haveOwnProperty('isBuilderError', true);
    });
  });
});

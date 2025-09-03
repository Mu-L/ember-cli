'use strict';

const tmp = require('tmp-promise');
const execa = require('execa');
const { join, resolve } = require('node:path');
const ember = require('../helpers/ember');
const { isExperimentEnabled } = require('@ember-tooling/blueprint-model/utilities/experiments');

const emberCliRoot = resolve(join(__dirname, '../..'));
const root = process.cwd();
let tmpDir;

describe('Acceptance: ember new (slow)', function () {
  this.timeout(500000);

  beforeEach(async function () {
    const { path } = await tmp.dir();
    tmpDir = path;
    process.chdir(path);
  });

  afterEach(function () {
    process.chdir(root);
  });

  describe('ember new', function () {
    if (isExperimentEnabled('VITE')) {
      before(function () {
        this.skip();
      });
    }

    it('generates a new app with no linting errors', async function () {
      await ember(['new', 'foo-app', '--pnpm', '--skip-npm']);
      // link current version of ember-cli in the newly generated app
      await execa('pnpm', ['link', emberCliRoot]);
      await execa('pnpm', ['lint'], { cwd: join(tmpDir, 'foo-app') });
    });

    it('generates a new strict app with no linting errors', async function () {
      await ember(['new', 'foo-app', '--strict', '--pnpm', '--skip-npm']);
      // link current version of ember-cli in the newly generated app
      await execa('pnpm', ['link', emberCliRoot]);
      await execa('pnpm', ['lint'], { cwd: join(tmpDir, 'foo-app') });
    });

    it('generates a new TS app with no linting errors', async function () {
      await ember(['new', 'foo-app', '--pnpm', '--typescript', '--skip-npm']);
      // link current version of ember-cli in the newly generated app
      await execa('pnpm', ['link', emberCliRoot]);
      await execa('pnpm', ['lint'], { cwd: join(tmpDir, 'foo-app') });
    });

    it('generates a new strict TS app with no linting errors', async function () {
      await ember(['new', 'foo-app', '--strict', '--pnpm', '--typescript', '--skip-npm']);
      // link current version of ember-cli in the newly generated app
      await execa('pnpm', ['link', emberCliRoot]);
      await execa('pnpm', ['lint'], { cwd: join(tmpDir, 'foo-app') });
    });
  });
});

#! /usr/bin/env node
'use strict';

const Octokat = require('octokat');
const program = require('commander');
const Repository = require('./repository').Repository;

function replaceLootMessageVersion(content, newVersion) {
  const regexp = /version\("LOOT", "[\d.]+", <\)/;
  return content.replace(regexp, `version("LOOT", "${newVersion}", <)`);
}

function replaceMetadataValidatorUrl(content, newMetadataValidatorVersion) {
  const regexp = /download\/\d+\.\d+.\d+\//;
  return content.replace(regexp, `download/${newMetadataValidatorVersion}/`);
}

function updateLootMessageVersion(repository, newVersion) {
  return repository.updateFile('masterlist.yaml', 'Update LOOT version check for new release message', replaceLootMessageVersion, newVersion);
}

function updateMasterlistValidator(repository, masterlistValidatorVersion) {
  return repository.updateFile('.travis.yml', 'Update metadata validator used', replaceMetadataValidatorUrl, masterlistValidatorVersion);
}

function collect(value, collection) {
  collection.push(value);
  return collection;
}

function parseArguments() {
  const knownRepositories = [
    'oblivion',
    'skyrim',
    'skyrimse',
    'fallout3',
    'falloutnv',
    'fallout4',
  ];

  program
    .version('1.2.0')
    .option('-t, --token <token>', 'GitHub Personal Access Token (required)')
    .option('-r, --repository <name>', 'A repeatable option for specifying repositories to operate on', collect, [])
    .option('-a, --all-repositories', 'Operate on all known repositories (' + knownRepositories.join(', ') + ')')
    .option('-b, --branch <name>', 'Create a new branch with the given name from the current default branch')
    .option('-d, --default-branch <name>', 'Set the default branch')
    .option('-n, --new-version <version>', 'Update the "LOOT update available" message condition to use the given version number')
    .option('-m, --masterlist-validator <version>', 'Update the masterlist validator used to the given version');

  program.on('--help', () => {
    console.log('If a combination of -b, -d and -n are specified, they act in order:\n');
    console.log('1. The branch is created')
    console.log('2. The default branch is set')
    console.log('3. The LOOT version condition is updated\n')
  });

  program.parse(process.argv);

  if (!program.token || (!program.repository.length && !program.allRepositories)) {
    program.help();
  }

  if (program.allRepositories) {
    program.repository = knownRepositories;
  }

  return {
    token: program.token,
    branch: program.branch,
    repositories: program.repository,
    version: program.newVersion,
    defaultBranch: program.defaultBranch,
    masterlistValidator: program.masterlistValidator,
  };
}

function main() {
  const settings = parseArguments();

  const github = new Octokat({
    token: settings.token,
  });

  settings.repositories.forEach((repositoryName) => {
    const repository = new Repository(github, repositoryName);
    let promise = Promise.resolve();

    if (settings.branch) {
      promise = repository.createBranchFromDefault(settings.branch);
    }

    if (settings.defaultBranch) {
      promise = promise.then(() => {
        return repository.setDefaultBranch(settings.defaultBranch);
      })
    }

    if (settings.version) {
      promise.then(() => {
        updateLootMessageVersion(repository, settings.version);
      });
    }

    if (settings.masterlistValidator) {
      promise.then(() => {
        updateMasterlistValidator(repository, settings.masterlistValidator);
      })
    }
  });
}

main();

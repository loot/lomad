#! /usr/bin/env node
'use strict';

const http = require('http');
const https = require('https');
const Octokat = require('octokat');
const program = require('commander');
const Repository = require('./repository').Repository;
const url = require('url');

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

function checkUrl(urlToCheck) {
  let parsedUrl = url.parse(urlToCheck);

  const options = {
    method: 'HEAD',
    protocol: parsedUrl.protocol,
    hostname: parsedUrl.hostname,
    port: parsedUrl.port,
    path: parsedUrl.path,
    agent: parsedUrl.protocol === 'https:' ? https.globalAgent : http.globalAgent,
  };

  if (!options.port && options.protocol === 'https') {
    options.port = 443;
  }

  return new Promise((resolve, reject) => {
    if (options.protocol !== 'http:' && options.protocol !== 'https:') {
      reject(`uses the ${options.protocol} protocol, not HTTP or HTTPS`);
    }

    const request = http.request(options, (response) => {
      if (response.statusCode == 200) {
        resolve(response.statusCode);
      } else if (response.statusCode >= 300 && response.statusCode < 400) {
        reject(`${response.statusCode}\n\tMoved to ${response.headers.location}`);
      } else {
        reject(`${response.statusCode}`);
      }
    });
    request.on('error', reject);
    request.end();
  });
}

function checkUrls(repository) {
  const urlRegex = /(\w+:\/\/[^\s)'>]+)/g;

  return repository.getFile('masterlist.yaml')
    .then((file) => {
      let match;
      let promises = [];
      do {
        match = urlRegex.exec(file.content);
        if (match) {
          const urlToCheck = match[0];
          const urlPromise = checkUrl(urlToCheck)
            .catch((error) => {
              console.log(`${urlToCheck}\n\t${error}`);
            });
          promises.push(urlPromise);
        }
      } while (match);
      return Promise.all(promises);
    }).catch(console.log);
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
    .option('-m, --masterlist-validator <version>', 'Update the masterlist validator used to the given version')
    .option('-c, --check-urls', 'Check for and print out invalid URLs (non-200 responses)');

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
    checkUrls: program.checkUrls,
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

    if (settings.checkUrls) {
      promise.then(() => {
        checkUrls(repository);
      });
    }

    promise.catch(console.log);
  });
}

main();

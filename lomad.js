#! /usr/bin/env node
'use strict';

const http = require('http');
const https = require('https');
const Octokat = require('octokat');
const { program } = require('commander');
const Repository = require('./repository').Repository;

function replaceMetadataValidatorUrl(content, newMetadataValidatorVersion) {
  const regexp = /download\/\d+\.\d+.\d+\//;
  return content.replace(regexp, `download/${newMetadataValidatorVersion}/`);
}

function updateMasterlistValidator(repository, masterlistValidatorVersion) {
  return repository.updateFile('.travis.yml', 'Update metadata validator used', replaceMetadataValidatorUrl, masterlistValidatorVersion);
}

function checkUrl(urlToCheck) {
  let parsedUrl = new URL(urlToCheck);

  const options = {
    method: 'HEAD',
    protocol: parsedUrl.protocol,
    hostname: parsedUrl.hostname,
    port: parsedUrl.port,
    path: `${parsedUrl.path}/${parsedUrl.search}`,
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

function parseArguments() {
  const knownRepositories = [
    'morrowind',
    'oblivion',
    'skyrim',
    'enderal',
    'skyrimse',
    'skyrimvr',
    'fallout3',
    'falloutnv',
    'fallout4',
    'fallout4vr',
    'starfield'
  ];

  program
    .version('1.3.0')
    .requiredOption('-t, --token <token>', 'GitHub Personal Access Token (required)')
    .option('-r, --repository <names...>', 'A repeatable option for specifying repositories to operate on')
    .option('-a, --all-repositories', `Operate on all known repositories (${knownRepositories.join(', ')})`)
    .option('-b, --branch <name>', 'Create a new branch with the given name from the current default branch')
    .option('-d, --default-branch <name>', 'Set the default branch')
    .option('-m, --masterlist-validator <version>', 'Update the masterlist validator used to the given version')
    .option('-c, --check-urls', 'Check for and print out invalid URLs (non-200 responses)');

  program.addHelpText('after', `
If both -b/--branch and -d/--default-branch are specified, the branch is created and then the default branch is set.
`);

  program.parse();

  const options = program.opts();

  if (!options.repository && !options.allRepositories) {
    console.log("error: at least one repository or -a or --all-repositories must be specified");
    process.exit(1);
  }

  if (options.allRepositories) {
    options.repository = knownRepositories;
  }

  return {
    token: options.token,
    branch: options.branch,
    repositories: options.repository,
    defaultBranch: options.defaultBranch,
    masterlistValidator: options.masterlistValidator,
    checkUrls: options.checkUrls,
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

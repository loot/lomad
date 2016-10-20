#! /usr/bin/env node
'use strict';

const Octokat = require('octokat');
const program = require('commander');

class Repository {
  constructor(apiHandle, name) {
    this.handle = apiHandle.repos('loot', name);
    this.name = name;
  }

  getDefaultBranch() {
    return this.handle.fetch().then((response) => {
      return response.defaultBranch;
    });
  }

  setDefaultBranch(newDefaultBranch) {
    return this.handle.update({
      name: this.name,
      default_branch: newDefaultBranch,
    });
  }

  getBranchHeadHash(branch) {
    return this.handle.git.refs(`heads/${branch}`).fetch().then((response) => {
      return response.object.sha;
    });
  }

  createNewBranch(sourceBranch, newBranch) {
    return this.getBranchHeadHash(sourceBranch).then((sha) => {
      return this.handle.git.refs.create({
        ref: `refs/heads/${newBranch}`,
        sha,
      }).catch((error) => {
        console.log(`Error creating new branch "${newBranch}":`);
        console.log(error);
      });
    });
  }

  createNewDefaultBranch(newBranch) {
    return this.getDefaultBranch().then((defaultBranch) => {
      return this.createNewBranch(defaultBranch, newBranch);
    }).then(() => {
      return this.setDefaultBranch(newBranch);
    }).catch((error) => {
      console.log(error);
    });
  }
}

function collect(value, collection) {
  collection.push(value);
  return collection;
}

function parseArguments() {
  const knownRepositories = [
    'oblivion',
    'skyrim',
    'fallout3',
    'falloutnv',
    'fallout4',
  ];

  program
    .version('1.0.0')
    .option('-t, --token <token>', 'GitHub Personal Access Token (required)')
    .option('-r, --repository <name>', 'A repeatable option for specifying repositories to operate on', collect, [])
    .option('-a, --all-repositories', 'Operate on all known repositories (' + knownRepositories.join(', ') + ')')
    .option('-b, --branch <name>', 'Create a new default branch with the given name')
    .parse(process.argv);

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
  };
}

function main() {
  const settings = parseArguments();

  const github = new Octokat({
    token: settings.token,
  });

  settings.repositories.forEach((repositoryName) => {
    const repository = new Repository(github, repositoryName);
    if (settings.branch) {
      repository.createNewDefaultBranch(settings.branch);
    }
  });
}

main();

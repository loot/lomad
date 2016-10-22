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

  createBranchFromDefault(newBranch) {
    return this.getDefaultBranch().then((defaultBranch) => {
      return this.createNewBranch(defaultBranch, newBranch);
    }).catch((error) => {
      console.log(error);
    });
  }

  getTree(commitHash) {
    return this.handle.git.trees(commitHash).fetch();
  }

  getFileBlobHash(tree, filename) {
    const blob = tree.find((element) => {
      return element.path === filename;
    });

    if (!blob) {
      throw new Error(`${filename} not found in tree`);
    }

    return blob.sha;
  }

  getTextFileBlobContent(blobHash) {
    return this.handle.git.blobs(blobHash).fetch().then((response) => {
      return (new Buffer(response.content, 'base64')).toString('utf8');
    });
  }

  createTreeWithBlob(parentTreeHash, blobHash, path) {
    return this.handle.git.trees.create({
      base_tree: parentTreeHash,
      tree: [{
        path,
        mode: '100644',
        type: 'blob',
        sha: blobHash,
      }],
    });
  }

  commitTree(parentCommitHash, treeHash, message) {
    return this.handle.git.commits.create({
      message: message,
      tree: treeHash,
      parents: [
        parentCommitHash,
      ],
    });
  }

  updateBranchHead(branch, commitHash) {
    return this.handle.git.refs(`heads/${branch}`).update({
      sha: commitHash,
    });
  }

  commitFileChange(parentCommitHash, filename, content, message) {
    let parentTreeHash;
    return this.getTree(parentCommitHash)
      .then((response) => {
        parentTreeHash = response.sha;
        return this.handle.git.blobs.create({content});
      })
      .then((response) => {
        return this.createTreeWithBlob(parentTreeHash, response.sha, filename);
      })
      .then((response) => {
        return this.commitTree(parentCommitHash, response.sha, message);
      });
  }
}

function replaceLootMessageVersion(content, newVersion) {
  const regexp = /version\("LOOT", "[\d.]+", <\)/;
  return content.replace(regexp, `version("LOOT", "${newVersion}", <)`);
}

function updateLootMessageVersion(repository, newVersion) {
  const filename = 'masterlist.yaml';
  let defaultBranch;
  let commitHash;

  return repository.getDefaultBranch()
    .then((branch) => {
      defaultBranch = branch;
      return repository.getBranchHeadHash(branch);
    })
    .then((hash) => {
      commitHash = hash;
      return repository.getTree(hash);
    })
    .then((response) => {
      return repository.getFileBlobHash(response.tree, filename);
    })
    .then((hash) => {
      return repository.getTextFileBlobContent(hash);
    })
    .then((content) => {
      return replaceLootMessageVersion(content, newVersion);
    })
    .then((content) => {
      return repository.commitFileChange(commitHash,
        filename,
        content,
        'Update LOOT version check for new release message');
    })
    .then((response) => {
      return repository.updateBranchHead(defaultBranch, response.sha);
    })
    .catch((error) => {
      console.log(error);
    });
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
    .option('-b, --branch <name>', 'Create a new branch with the given name from the current default branch')
    .option('-d, --default-branch <name>', 'Set the default branch')
    .option('-n, --new-version <version>', 'Update the "LOOT update available" message condition to use the given version number');

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
  });
}

main();

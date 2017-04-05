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

  updateFile(filename, commitMessage, editContentFunction, newContent) {
    let defaultBranch;
    let commitHash;

    return this.getDefaultBranch()
      .then((branch) => {
        defaultBranch = branch;
        return this.getBranchHeadHash(branch);
      })
      .then((hash) => {
        commitHash = hash;
        return this.getTree(hash);
      })
      .then((response) => {
        return this.getFileBlobHash(response.tree, filename);
      })
      .then((hash) => {
        return this.getTextFileBlobContent(hash);
      })
      .then((content) => {
        return editContentFunction(content, newContent);
      })
      .then((content) => {
        return this.commitFileChange(commitHash,
          filename,
          content,
          commitMessage);
      })
      .then((response) => {
        return this.updateBranchHead(defaultBranch, response.sha);
      })
      .catch((error) => {
        console.log(error);
      });
  }
}

module.exports.Repository = Repository;

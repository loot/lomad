const { Octokit } = require('octokit');

class Repository {
  /** @param {Octokit} octokit */
  constructor(octokit, name) {
    this.client = octokit.rest;
    this.commonParams = {
      owner: 'loot',
      repo: name
    };
  }

  async getDefaultBranch() {
    const response = await this.client.repos.get(this.commonParams);

    return response.data.default_branch;
  }

  setDefaultBranch(newDefaultBranch) {
    return this.client.repos.update({
      default_branch: newDefaultBranch,
      ...this.commonParams
    });
  }

  async getBranchHeadHash(branch) {
    const response = await this.client.git.getRef({
      ref: `heads/${branch}`,
      ...this.commonParams
    });

    return response.data.object.sha;
  }

  async createNewBranch(sourceBranch, newBranch) {
    const sha = await this.getBranchHeadHash(sourceBranch);

    return this.client.git.createRef({
      ...this.commonParams,
      ref: `refs/heads/${newBranch}`,
      sha,
    }).catch((error) => {
      console.log(`Error creating new branch "${newBranch}":`);
      console.log(error);
      return error;
    });
  }

  async createBranchFromDefault(newBranch) {
    const defaultBranch = await this.getDefaultBranch();

    return this.createNewBranch(defaultBranch, newBranch);
  }

  async getTree(commitHash) {
    const response = await this.client.git.getTree({
      ...this.commonParams,
      tree_sha: commitHash,
    });

    return {
      sha: response.data.sha,
      tree: response.data.tree,
    };
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

  async getTextFileBlobContent(blobHash) {
    const response = await this.client.git.getBlob({
      ...this.commonParams,
      file_sha: blobHash,
    });

    return Buffer.from(response.data.content, response.data.encoding).toString('utf8');
  }

  createTreeWithBlob(parentTreeHash, blobHash, path) {
    return this.client.git.createTree({
      ...this.commonParams,
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
    return this.client.git.createCommit({
      ...this.commonParams,
      message: message,
      tree: treeHash,
      parents: [
        parentCommitHash,
      ],
    });
  }

  updateBranchHead(branch, commitHash) {
    return this.client.git.updateRef({
      ...this.commonParams,
      ref: `heads/${branch}`,
      sha: commitHash,
    });
  }

  async commitFileChange(parentCommitHash, filename, content, message) {
    const { sha: parentTreeHash } = await this.getTree(parentCommitHash);

    const blobResponse = await this.client.git.createBlob({
      ...this.commonParams,
      content,
    });

    const treeResponse = await this.createTreeWithBlob(parentTreeHash, blobResponse.data.sha, filename);

    return this.commitTree(parentCommitHash, treeResponse.data.sha, message);
  }

  async getFile(filename) {
    const defaultBranchName = await this.getDefaultBranch();

    const defaultBranchHash = await this.getBranchHeadHash(defaultBranchName);

    const defaultBranchTree = await this.getTree(defaultBranchHash);

    const fileBlobHash = await this.getFileBlobHash(defaultBranchTree.tree, filename);

    const fileContent = await this.getTextFileBlobContent(fileBlobHash);

    return {
      branch: defaultBranchName,
      commit: defaultBranchHash,
      content: fileContent,
    };
  }

  async updateFile(filename, commitMessage, editContentFunction, newContent) {
    const file = await this.getFile(filename);

    const content = editContentFunction(file.content, newContent);

    const response = await this.commitFileChange(file.commit,
          filename,
          content,
          commitMessage);

    return this.updateBranchHead(file.branch, response.data.sha);
  }
}

module.exports.Repository = Repository;

# lomad

[![npm](https://img.shields.io/npm/v/lomad.svg)](https://www.npmjs.com/package/lomad)

A utility for administrating the LOOT masterlists.

The LOOT masterlists occasionally need to be branched when a new syntax version is developed, and when there's a new release of LOOT the version number they check for needs to be updated. This utility is intended to automate such tasks.

If supplying a fine-grained personal access token, the token must be configured with the following:

- Resource owner: loot
- Repository access: preferably "Only select repositories" with the masterlist repositories selected, or "All repositories"
- Permissions:

  - `-b` needs "Contents (Read and write)"
  - `-d` needs "Administration (Read and write)"
  - `-m` needs "Contents (Read and write)"

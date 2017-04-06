# Change Log

The format is based on [Keep a Changelog](http://keepachangelog.com/) and this
project adheres to [Semantic Versioning](http://semver.org/).

## 1.3.0 - 2017-04-06

### Added

- The ability to check the URLs in the masterlists for validity. Invalid URLs
  are any that are not HTTP or HTTPS, or which give non-200 response codes when
  queried with a `HEAD` request.

### Changed

- The Octokat dependency has been updated to v0.6.4.

## 1.2.0 - 2016-12-18

### Added

- The ability to update the metadata validator used to validate the masterlists.

## 1.1.0 - 2016-10-21

### Added

- The ability to update masterlists' LOOT version check conditions.
- Support for the `skyrimse` masterlist repository.

### Changed

- Branches are now created and set as the default branch in separate operations.

## 1.0.0 - 2016-10-20

### Added

- The ability to create a new branch and set it to the default for the
  `oblivion`, `skyrim`, `fallout3`, `falloutnv` and `fallout4` masterlist
  repositories.

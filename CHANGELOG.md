# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Production prep: SimpleMemory/recordExecution fix, portable paths, code signing docs, CI build exe, changelog.

### Fixed

- **SimpleMemory.recordExecution** now uses the same signature as AIMemory (`toolCall`, `result`) so default memory behavior is correct when tools run.
- Sidebar collapse now works after resizing (inline width cleared when toggling collapse); drag-to-collapse via resizer.
- CodeMirror load: shared ref and init-order fix so the editor loads reliably in the packaged app.

### Changed

- User data (memory, plugins, error memory, AI DB) now uses Electron `app.getPath('userData')` when available for correct paths on clean/portable installs.
- CI: tests + lint on Ubuntu and Windows; separate job builds Windows installer and uploads artifact.

## [1.0.0] - (prior to changelog)

- Initial Impulse IDE release: compile, upload, serial monitor, AI assistant, error memory, modern UI.

[Unreleased]: https://github.com/your-github-org/arduino-ide-cursor/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/your-github-org/arduino-ide-cursor/releases/tag/v1.0.0

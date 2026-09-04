// .versionrc.js
// standard-version configuration for deadair.
// Uses conventional commits to auto-generate changelogs + semver tags.

module.exports = {
  types: [
    { type: 'feat', section: 'Features' },
    { type: 'fix', section: 'Bug Fixes' },
    { type: 'perf', section: 'Performance' },
    { type: 'refactor', section: 'Code Refactoring' },
    { type: 'docs', section: 'Documentation' },
    { type: 'test', section: 'Tests' },
    { type: 'build', section: 'Build System' },
    { type: 'ci', section: 'CI/CD' },
    { type: 'chore', hidden: true },
    { type: 'revert', section: 'Reverts' },
    { type: 'style', hidden: true },
  ],
  // Skip prompts for automated runs
  skip: { commit: true, tag: false },
  // Commit message prefix for the release commit
  commitMessage: 'chore(release): v{{currentTag}}',
  // Tag prefix
  tagPrefix: 'v',
};

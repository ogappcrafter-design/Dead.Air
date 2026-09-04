// commitlint.config.js
// Enforces conventional commits across the deadair repo.
// See https://commitlint.js.org/reference/rules for full rule list.

module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    // type must be one of these (matching conventional-commit scopes in the repo)
    'type-enum': [
      2,
      'always',
      [
        'feat',
        'fix',
        'docs',
        'style',
        'refactor',
        'perf',
        'test',
        'build',
        'ci',
        'chore',
        'revert',
      ],
    ],
    // subject max length — keep commit subjects concise
    'subject-max-length': [2, 'always', 100],
    // body max line length — wrap long lines
    'body-max-line-length': [1, 'always', 200],
  },
};

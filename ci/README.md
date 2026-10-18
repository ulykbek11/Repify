# CI workflow

`github-actions-ci.yml` is the GitHub Actions workflow for this repository: backend `pytest` and `ruff` on Python 3.11 and 3.12 (plus a check that the bundled demo samples are up to date) and the app's ESLint and web export.

It lives here because the token that prepared this branch has no `workflow` scope and GitHub refuses to accept workflow files from it. To enable CI, move it:

```bash
mkdir -p .github/workflows
git mv ci/github-actions-ci.yml .github/workflows/ci.yml
```

Then commit and push with a credential that is allowed to change workflows (your own login, or a token with the `workflow` scope). The README badge starts working after the first run. The same commands run locally, see [CONTRIBUTING.md](../CONTRIBUTING.md).

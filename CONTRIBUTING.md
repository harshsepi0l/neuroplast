# Contributing to neuroplast

Thanks for your interest. Contributions are accepted under the repository's
AGPL-3.0-only license; see [LICENSE](LICENSE). You retain copyright in your
original contributions.

## Workflow

All changes land through pull requests. There is no direct push to `main`.

1. Fork the repository (or, if you are a maintainer, create a feature branch).
2. Make your change on a new branch.
3. Open a pull request against `main`.
4. A maintainer reviews and merges it. Review is required; no one may push
   straight to `main`.

## Before you open a pull request

- Explain the problem, the resulting behavior, and how you verified the change.
- Run the typecheck, lint, and production build:

  ```sh
  npm run typecheck
  npm run lint
  npm run build
  ```

- Only submit work you have authority to license. Identify any third-party
  materials and preserve their required notices.

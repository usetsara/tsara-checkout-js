# Releasing Tsara Checkout JS

## Before releasing

1. Update `version` in `package.json` with `npm version patch`, `npm version minor`, or `npm version major`.
2. Confirm the generated version commit and tag are correct.
3. Push the commit and version tag to the package repository.
4. Create a GitHub release whose tag exactly matches `v<package-version>`.

The publish workflow verifies that the GitHub release tag matches `package.json`, then runs tests, type checking, the production build, and `npm publish --access public --provenance`.

## One-time npm configuration

Configure npm trusted publishing for `@tsara/checkout-js` with:

- provider: GitHub Actions
- repository owner and repository: the GitHub repository containing this package
- workflow filename: `npm-publish.yml`
- environment: leave blank unless the workflow is later assigned a protected GitHub environment

Trusted publishing uses GitHub OIDC and does not require a long-lived `NPM_TOKEN` secret.

## Release commands

```bash
npm version patch
git push origin HEAD --follow-tags
```

Then create and publish the matching GitHub release. Do not reuse or overwrite an npm version; published package versions are immutable.

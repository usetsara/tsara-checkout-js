# Publishing `@tsara/checkout-js`

This package is published to npm through GitHub Actions using npm Trusted Publishing.

## One-time npm setup

Configure a trusted publisher for the package on npm:

- Provider: GitHub Actions
- Owner: `chrisasek`
- Repository: `tsara-checkout-js`
- Workflow filename: `npm-publish.yml`
- Environment: leave empty unless the workflow is later assigned a GitHub environment

The workflow is located at `.github/workflows/npm-publish.yml` and runs when a GitHub Release is published.

## Publish a new version

Start from an up-to-date and clean `main` branch:

```powershell
git checkout main
git pull origin main
git status
```

Run the tests before creating the release:

```powershell
npm ci
npm test
npm run typecheck
npm run build
```

Create the next patch version. For example, this changes `0.1.0` to `0.1.1`, creates a commit, and creates the local Git tag `v0.1.1`:

```powershell
npm version patch
```

Push the version commit and tag:

```powershell
git push origin main --follow-tags
```

This pushes the tag but does not create or publish a GitHub Release.

## Publish the GitHub Release

### GitHub website

1. Open the `chrisasek/tsara-checkout-js` repository.
2. Open **Releases** and select **Draft a new release**.
3. Select the existing version tag, such as `v0.1.1`.
4. Use the version as the release title.
5. Add or generate the release notes.
6. Select **Publish release**.

Publishing the release triggers `.github/workflows/npm-publish.yml`, which installs dependencies, tests, type-checks, builds, and publishes the matching package version to npm with provenance.

### GitHub CLI

If GitHub CLI is installed and authenticated, publish the release using the existing tag:

```powershell
gh release create v0.1.1 --title "v0.1.1" --generate-notes
```

## Verify the publication

After the GitHub Actions workflow succeeds, verify the published version:

```powershell
npm view @tsara/checkout-js version
npm view @tsara/checkout-js dist-tags
```

The reported `latest` version should match the GitHub Release and `package.json` version.

## Version choices

Use the appropriate npm version command:

```powershell
npm version patch  # Bug fix: 0.1.1 -> 0.1.2
npm version minor  # Backward-compatible feature: 0.1.1 -> 0.2.0
npm version major  # Breaking change: 0.1.1 -> 1.0.0
```

Never attempt to publish an npm version that already exists. npm package versions are immutable.

## Common failures

- **Release tag does not match package version:** The workflow requires tag `vX.Y.Z` to match the version in `package.json`.
- **Version already published:** Run the appropriate `npm version` command and publish a new release.
- **Trusted publishing or 2FA error:** Confirm the npm trusted-publisher owner, repository, and workflow filename match exactly.
- **Workflow does not start:** Confirm a GitHub Release was published; pushing a tag alone does not trigger this workflow.
- **Tests or build fail:** Fix the failure locally, then create a new version. Do not reuse a version that npm already accepted.

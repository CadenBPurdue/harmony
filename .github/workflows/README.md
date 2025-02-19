# GitHub Workflows

This directory contains the GitHub workflows for this repository. Each workflow is defined in a separate YAML file.

## Workflow Files

#### [release-tag](release-tag.yml)

This workflow is triggered when a new version tag is pushed to the repository.

This can be done by running the following command:

```
git tag vX.Y.Z && git push -tags
```

If you need to delete and recreate a tag, you can do so with the following commands:

```bash
git tag -f vX.Y.Z && git push -f --tags
```

If you just want to delete a tag (both locally and remotely), you can use:

```bash
git tag -d vX.Y.Z && git push --delete origin vX.Y.Z
```

#### [release-manual.yml](release-manual.yml)

This workflow is triggered manually in 2 ways:

1. Manual trigger on github.com

This can be done by going to the "Actions" tab of the repository, selecting the "Build Release" workflow, and clicking on the "Run workflow" button. There is an input field for the operating system. This can be left empty to build for all operating systems, or set to a comma-separated list of operating systems. The available options are:
- `ubuntu-latest`
- `windows-latest`
- `macos-latest`

2. Triggered by GitHub CLI

This can be done by running the following command:

```bash
gh workflow run release-manual.yml -f os=macos-latest,ubuntu-latest
```

If you want to run on a different branch, you can use the `--ref` option to specify the branch. For example, to run on the `develop` branch on macos and ubuntu, you can use the following command:

```bash
gh workflow run release-manual.yml --ref develop -f os=macos-latest
```

gh workflow run build-release.yml --ref develop -f os=macos-latest

#### [build-test](build-test.yml)

This workflow is triggered on every push to the repository. It just builds the project for development and runs the tests (when they are written).

#### [linter](linter.yml)

This workflow is triggered on every push to the repository. It runs the linter on the codebase with the `--fix` option. This will attempt to fix any linting errors automatically. 
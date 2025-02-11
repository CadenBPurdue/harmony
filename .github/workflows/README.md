# GitHub Workflows

This directory contains the GitHub workflows for this repository. Each workflow is defined in a separate YAML file.

## Workflow Files

#### [build-release](build-release.yml)

This workflow is triggered in two ways:

1. A new version tag is pushed to the repository.

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

2. Manual triggering of the workflow.

This can be done by going to the "Actions" tab of the repository, selecting the "Build Release" workflow, and clicking on the "Run workflow" button. There is an input field for the operating system. This can be left empty to build for all operating systems, or set to a comma-separated list of operating systems. The available options are:
- `ubuntu-latest`
- `windows-latest`
- `macos-latest`

> **Note:** This method only runs on the `main` branch. If you want to run it on a different branch, can use the GitHub CLI to trigger the workflow. For example, to run it on the `develop` branch on macos and ubuntu, you can use the following command:
>```bash
>gh workflow run build-release.yml --ref develop os=macos-latest,ubuntu-latest
>```

#### [build-test](build-test.yml)

This workflow is triggered on every push to the repository. It just builds the project for development and runs the tests (when they are written).

#### [linter](linter.yml)

This workflow is triggered on every push to the repository. It runs the linter on the codebase with the `--fix` option. This will attempt to fix any linting errors automatically. 
# Agent workflow

Ship changes through an issue, then a pull request. Do not commit feature work directly to `main`.

## 1. Open the issue first

Create the GitHub issue before the branch.

```bash
gh issue create --title "Short outcome" --body "$(cat <<'EOF'
## Problem
What is wrong or missing.

## Done when
- The observable result

EOF
)"
```

Use the issue number in the branch name, for example `12-place-time`.

## 2. Branch from main

```bash
git checkout main
git pull origin main
git checkout -b 12-short-name
```

One issue per pull request. Keep unrelated edits out of the branch.

## 3. Open the pull request

The body must close the issue so the merge closes it.

```bash
gh pr create --title "Short outcome" --body "$(cat <<'EOF'
## Summary
- What changed and why

Closes #12

## Test plan
- [ ] What to try

EOF
)"
```

## 4. Review before merge

On the pull request branch, run both reviews and report the results:

- Bugbot, with `Diff: branch changes`
- Security Review, with `Diff: branch changes`

Leave findings in the reply. Fix them only when asked. Merge only when asked, with `gh pr merge <number> --merge`.

## Checks

- `.github/workflows/pull-request.yml` fails a pull request whose body does not contain `Closes #`, `Fixes #`, or `Resolves #` and an issue number.
- `.github/workflows/ci.yml` builds the site on every pull request. A push to `main` publishes that build to GitHub Pages.

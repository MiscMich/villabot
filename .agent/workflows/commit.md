# Commit Commands Skill

Streamline git workflow with automated commits and PRs.

## Commands

### /commit
Creates a git commit with automatically generated commit message.

**What it does:**
1. Analyzes current git status
2. Reviews both staged and unstaged changes
3. Examines recent commit messages to match repo's style
4. Drafts an appropriate commit message
5. Stages relevant files
6. Creates the commit

**Best practices:**
- Follows conventional commit practices
- Avoids committing files with secrets (.env, credentials.json)
- Matches your repo's commit style

### /commit-push-pr
Complete workflow: commits, pushes, and creates a pull request.

**What it does:**
1. Creates a new branch (if currently on main)
2. Stages and commits changes with appropriate message
3. Pushes the branch to origin
4. Creates a pull request using `gh pr create`
5. Provides the PR URL

**PR description includes:**
- Summary of changes (1-3 bullet points)
- Test plan checklist
- Analyzes all commits in the branch

### /clean_gone
Cleans up local branches deleted from remote.

**What it does:**
1. Lists all local branches to identify [gone] status
2. Identifies and removes worktrees associated with [gone] branches
3. Deletes all branches marked as [gone]
4. Provides feedback on removed branches

## Workflow Patterns

### Quick commit workflow
```bash
# Write code
/commit
# Continue development
```

### Feature branch workflow
```bash
# Develop feature across multiple commits
/commit  # First commit
# More changes
/commit  # Second commit
# Ready to create PR
/commit-push-pr
```

### Maintenance workflow
```bash
# After several PRs are merged
/clean_gone
# Clean workspace ready for next feature
```

## Requirements

- Git installed and configured
- For `/commit-push-pr`: GitHub CLI (`gh`) installed and authenticated
- Repository must have a remote named `origin`

## Conventional Commit Types

- `feat:` - New feature
- `fix:` - Bug fix
- `docs:` - Documentation only
- `style:` - Formatting changes
- `refactor:` - Code refactoring
- `test:` - Adding tests
- `chore:` - Maintenance tasks

# Git Branching Strategy

## Branch Structure

### Main Branches
- **`main`** - Production-ready code, always deployable
- **`develop`** - Integration branch for features, staging environment

### Supporting Branches
- **`feature/*`** - New features and enhancements
- **`bugfix/*`** - Bug fixes for current release
- **`hotfix/*`** - Critical fixes for production
- **`release/*`** - Release preparation and stabilization

## Workflow Guidelines

### Feature Development
1. Create feature branch from `develop`
   ```bash
   git checkout develop
   git pull origin develop
   git checkout -b feature/task-description
   ```

2. Work on feature with atomic commits
   - Use descriptive commit messages
   - Reference task numbers when applicable
   - Keep commits focused and logical

3. Push feature branch and create Pull Request
   ```bash
   git push origin feature/task-description
   ```

4. PR must target `develop` branch
5. Require code review before merging
6. Use squash merge to maintain clean history

### Bug Fixes
- **Current release bugs**: Create `bugfix/*` branch from `develop`
- **Production hotfixes**: Create `hotfix/*` branch from `main`

### Release Process
1. Create `release/*` branch from `develop`
2. Perform final testing and bug fixes
3. Merge to both `main` and `develop`
4. Tag release on `main`
5. Deploy from `main` branch

## Commit Message Format

```
type(scope): brief description

Detailed explanation if needed

- List specific changes
- Reference task/issue numbers
- Include breaking changes if any
```

### Commit Types
- **feat**: New feature
- **fix**: Bug fix
- **docs**: Documentation changes
- **style**: Code style changes (formatting, etc.)
- **refactor**: Code refactoring
- **test**: Adding or updating tests
- **chore**: Build process, dependencies, etc.

### Examples
```
feat(export): add CSV export functionality

Implement comprehensive CSV export with field selection
and batch processing for large datasets.

- Add DataExportDialog component
- Implement batch processing for 10k+ records
- Support custom field selection and formatting
- Add progress tracking and error handling

Closes #123
```

```
fix(auth): resolve SSO token refresh issue

Fix race condition in token refresh that caused
authentication failures during long sessions.

- Add proper token refresh locking
- Improve error handling for expired tokens
- Add retry logic for network failures

Fixes #456
```

## Pull Request Guidelines

### PR Requirements
- Clear title describing the change
- Detailed description with context
- Link to related tasks/issues
- Screenshots for UI changes
- Test coverage for new functionality

### PR Template
```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
- [ ] Unit tests added/updated
- [ ] Integration tests pass
- [ ] Manual testing completed

## Screenshots (if applicable)
Add screenshots for UI changes

## Checklist
- [ ] Code follows project style guidelines
- [ ] Self-review completed
- [ ] Comments added for complex logic
- [ ] Documentation updated
- [ ] No console errors or warnings
```

### Review Process
1. **Automated Checks**
   - All tests must pass
   - Code coverage requirements met
   - Linting and formatting checks pass
   - Build succeeds

2. **Code Review**
   - At least one approval required
   - Focus on code quality, security, performance
   - Verify requirements are met
   - Check for proper error handling

3. **Merge Requirements**
   - All conversations resolved
   - CI/CD pipeline green
   - Up-to-date with target branch

## Branch Protection Rules

### `main` Branch
- Require pull request reviews
- Require status checks to pass
- Require branches to be up to date
- Restrict pushes to administrators only
- Require linear history

### `develop` Branch
- Require pull request reviews
- Require status checks to pass
- Allow force pushes for maintainers
- Delete head branches after merge

## Release Versioning

Follow Semantic Versioning (SemVer):
- **MAJOR**: Breaking changes
- **MINOR**: New features (backward compatible)
- **PATCH**: Bug fixes (backward compatible)

### Version Format
- Production: `v1.2.3`
- Pre-release: `v1.2.3-beta.1`
- Development: `v1.2.3-dev.20241201`

## Best Practices

### Commit Practices
- Make atomic commits (one logical change per commit)
- Write clear, descriptive commit messages
- Avoid committing work-in-progress code
- Use interactive rebase to clean up history before PR

### Branch Management
- Keep feature branches short-lived (< 1 week)
- Regularly sync with `develop` to avoid conflicts
- Delete merged branches promptly
- Use descriptive branch names

### Code Quality
- Follow established coding standards
- Add tests for new functionality
- Update documentation for changes
- Perform self-review before requesting review

### Collaboration
- Communicate changes that affect others
- Use draft PRs for work-in-progress
- Provide context in PR descriptions
- Be responsive to review feedback

## Emergency Procedures

### Hotfix Process
1. Create hotfix branch from `main`
2. Implement minimal fix
3. Test thoroughly
4. Create PR to `main`
5. After merge, cherry-pick to `develop`
6. Deploy immediately

### Rollback Process
1. Identify last known good commit
2. Create rollback branch
3. Revert problematic changes
4. Follow hotfix process
5. Investigate root cause

## Tools and Automation

### Git Hooks
- Pre-commit: Run linting and formatting
- Pre-push: Run quick test suite
- Commit-msg: Validate commit message format

### CI/CD Integration
- Automated testing on all PRs
- Deployment from `main` branch only
- Staging deployment from `develop`
- Automated dependency updates

This branching strategy ensures code quality, enables parallel development, and maintains a stable production environment while supporting rapid feature development.
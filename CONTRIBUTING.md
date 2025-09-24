# Contributing to AWS Network Flow Visualizer

## Branching Strategy

We use **GitHub Flow** to ensure code quality and maintain a stable main branch.

### Workflow

1. **Create a feature branch** from `main`:
   ```bash
   git checkout main
   git pull origin main
   git checkout -b feature/task-description
   ```

2. **Branch naming convention**:
   - `feature/task-N-description` - For implementing tasks (e.g., `feature/task-2-aws-authentication`)
   - `bugfix/issue-description` - For bug fixes
   - `docs/update-description` - For documentation updates
   - `refactor/component-name` - For refactoring

3. **Work on your feature**:
   - Make focused commits with clear messages
   - Follow conventional commit format: `type: description`
   - Run tests before committing: `npm test`
   - Run linting: `npm run lint`

4. **Push your branch**:
   ```bash
   git push origin feature/your-branch-name
   ```

5. **Create a Pull Request**:
   - Use the PR template
   - Link to related task/issue
   - Ensure all checks pass
   - Request review

6. **After merge**:
   ```bash
   git checkout main
   git pull origin main
   git branch -d feature/your-branch-name
   ```

### Commit Message Format

Use [Conventional Commits](https://www.conventionalcommits.org/):

```
type(scope): description

[optional body]

[optional footer]
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Maintenance tasks

**Examples:**
```
feat(auth): implement AWS SSO authentication
fix(ui): resolve topology rendering issue
docs: update installation instructions
test(auth): add unit tests for credential validation
```

### Code Quality Requirements

Before creating a PR, ensure:

- [ ] All tests pass: `npm test`
- [ ] No linting errors: `npm run lint`
- [ ] TypeScript compiles: `npm run typecheck`
- [ ] Build succeeds: `npm run build`
- [ ] Code is formatted: `npm run format`

### Pull Request Process

1. **PR Title**: Use conventional commit format
2. **Description**: 
   - What changes were made
   - Why the changes were necessary
   - How to test the changes
   - Link to related task/issue
3. **Checklist**: Complete the PR template checklist
4. **Review**: At least one approval required
5. **Merge**: Use "Squash and merge" to keep history clean

### Branch Protection Rules

The `main` branch is protected with:
- Require pull request reviews
- Require status checks to pass
- Require branches to be up to date
- No direct pushes to main
- Delete head branches after merge

### Development Workflow for Tasks

When implementing tasks from the spec:

1. **Create task branch**:
   ```bash
   git checkout -b feature/task-2-aws-authentication
   ```

2. **Update task status** in tasks.md to "in_progress"

3. **Implement the task** following the requirements

4. **Update task status** to "completed" when done

5. **Create PR** with task reference

6. **Merge after review**

### Emergency Hotfixes

For critical production issues:

1. Create `hotfix/description` branch from `main`
2. Fix the issue with minimal changes
3. Create PR with expedited review
4. Merge immediately after approval
5. Ensure fix is included in next feature development

## Getting Help

- Check existing issues and PRs
- Review the project documentation in `.kiro/specs/`
- Ask questions in PR comments
- Follow the task-based development approach outlined in `tasks.md`
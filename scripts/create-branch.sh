#!/bin/bash

# Script to create a properly named feature branch
# Usage: ./scripts/create-branch.sh task-2 "aws authentication"

if [ $# -ne 2 ]; then
    echo "Usage: $0 <task-number> <description>"
    echo "Example: $0 task-2 \"aws authentication\""
    exit 1
fi

TASK_NUMBER=$1
DESCRIPTION=$2

# Convert description to kebab-case
BRANCH_NAME="feature/${TASK_NUMBER}-$(echo "$DESCRIPTION" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9]/-/g' | sed 's/--*/-/g' | sed 's/^-\|-$//g')"

echo "Creating branch: $BRANCH_NAME"

# Ensure we're on main and up to date
git checkout main
git pull origin main

# Create and checkout the new branch
git checkout -b "$BRANCH_NAME"

echo "✅ Created and switched to branch: $BRANCH_NAME"
echo ""
echo "Next steps:"
echo "1. Implement your changes"
echo "2. Run tests: npm test"
echo "3. Run linting: npm run lint"
echo "4. Commit with conventional format: git commit -m 'feat: your description'"
echo "5. Push: git push origin $BRANCH_NAME"
echo "6. Create Pull Request on GitHub"
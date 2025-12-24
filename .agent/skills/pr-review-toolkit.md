# PR Review Toolkit

A comprehensive collection of specialized review focuses for thorough pull request review.

## When to Use

Use these review patterns for:
- Before creating PRs
- During code review
- After implementing features

## Review Focuses

### 1. Comment Analyzer
**Focus**: Code comment accuracy and maintainability

Analyzes:
- Comment accuracy vs actual code
- Documentation completeness
- Comment rot and technical debt
- Misleading or outdated comments

### 2. Test Analyzer
**Focus**: Test coverage quality and completeness

Analyzes:
- Behavioral vs line coverage
- Critical gaps in test coverage
- Test quality and resilience
- Edge cases and error conditions

Rate test gaps 1-10 (10 = critical, must add)

### 3. Silent Failure Hunter
**Focus**: Error handling and silent failures

Analyzes:
- Silent failures in catch blocks
- Inadequate error handling
- Inappropriate fallback behavior
- Missing error logging

### 4. Type Design Analyzer
**Focus**: Type design quality and invariants

Rate 1-10:
- Type encapsulation
- Invariant expression
- Type usefulness
- Invariant enforcement

### 5. Code Reviewer
**Focus**: General code review for project guidelines

Analyzes:
- CLAUDE.md / project guideline compliance
- Style violations
- Bug detection
- Code quality issues

Score issues 0-100 (91-100 = critical)

### 6. Code Simplifier
**Focus**: Code simplification and refactoring

Analyzes:
- Code clarity and readability
- Unnecessary complexity and nesting
- Redundant code and abstractions
- Overly compact or clever code

**Preserves functionality while improving structure.**

## Recommended Workflow

### Before Committing
1. code-reviewer (general quality)
2. silent-failure-hunter (if changed error handling)

### Before Creating PR
1. test-analyzer (coverage check)
2. comment-analyzer (if added/modified comments)
3. type-design-analyzer (if added/modified types)
4. code-reviewer (final sweep)

### After Passing Review
1. code-simplifier (improve clarity)

## Confidence Scoring

All reviews provide confidence scores:
- Issues 0-79: Review but may be false positive
- Issues 80+: High confidence, likely correct
- Critical (91-100): Must address before merge

## Output Format

All reviews provide:
- Clear issue identification
- Specific file and line references
- Explanation of why it's a problem
- Suggestions for improvement
- Prioritized by severity

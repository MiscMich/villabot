# Superpowers Workflow

A complete software development workflow for coding agents.

## Philosophy

- **Test-Driven Development** - Write tests first, always
- **Systematic over ad-hoc** - Process over guessing
- **Complexity reduction** - Simplicity as primary goal
- **Evidence over claims** - Verify before declaring success

## The Basic Workflow

### 1. Brainstorming
**Activates before writing code**

- Doesn't just jump into code
- Asks what you're really trying to do
- Refines rough ideas through questions
- Explores alternatives
- Presents design in sections for validation
- Saves design document

### 2. Git Worktrees (Optional)
**Activates after design approval**

- Creates isolated workspace on new branch
- Runs project setup
- Verifies clean test baseline

### 3. Writing Plans
**Activates with approved design**

- Breaks work into bite-sized tasks (2-5 minutes each)
- Every task has exact file paths
- Complete code for each task
- Verification steps

### 4. Executing Plans
**Activates with plan**

Options:
- **Subagent-driven**: Fresh subagent per task with two-stage review
- **Batch execution**: Execute in batches with human checkpoints

### 5. Test-Driven Development
**Activates during implementation**

Enforces RED-GREEN-REFACTOR:
1. Write failing test
2. Watch it fail
3. Write minimal code
4. Watch it pass
5. Commit

**Deletes code written before tests.**

### 6. Code Review
**Activates between tasks**

- Reviews against plan
- Reports issues by severity
- Critical issues block progress

### 7. Finishing
**Activates when tasks complete**

- Verifies tests pass
- Presents options: merge/PR/keep/discard
- Cleans up worktree

## Skills Library

### Testing
- **test-driven-development** - RED-GREEN-REFACTOR cycle

### Debugging
- **systematic-debugging** - 4-phase root cause process
- **verification-before-completion** - Ensure it's actually fixed

### Collaboration
- **brainstorming** - Socratic design refinement
- **writing-plans** - Detailed implementation plans
- **executing-plans** - Batch execution with checkpoints
- **requesting-code-review** - Pre-review checklist
- **receiving-code-review** - Responding to feedback

## Key Commands

```
/superpowers:brainstorm - Interactive design refinement
/superpowers:write-plan - Create implementation plan
/superpowers:execute-plan - Execute plan in batches
```

## Anti-Patterns to Avoid

- Jumping into code without design
- Writing code before tests
- Declaring success without verification
- Guessing at solutions
- Complex solutions when simple ones work

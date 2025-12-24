# Feature Development Skill

A comprehensive, structured 7-phase workflow for building features properly.

## When to Use

Use `/feature-dev` when:
- Building new features that touch multiple files
- Features requiring architectural decisions
- Complex integrations with existing code
- Requirements are somewhat unclear

## The 7-Phase Workflow

### Phase 1: Discovery
**Goal**: Understand what needs to be built

- Clarify the feature request
- Ask what problem you're solving
- Identify constraints and requirements
- Summarize understanding and confirm

### Phase 2: Codebase Exploration
**Goal**: Understand relevant existing code and patterns

- Find similar features and trace implementation
- Map the architecture and abstractions
- Identify key files to read
- Present comprehensive summary

### Phase 3: Clarifying Questions
**Goal**: Fill in gaps and resolve all ambiguities

Before designing, identify:
- Edge cases
- Error handling
- Integration points
- Backward compatibility
- Performance needs

**Wait for answers before proceeding.**

### Phase 4: Architecture Design
**Goal**: Design multiple implementation approaches

Design 2-3 approaches with different focuses:
1. **Minimal changes**: Smallest change, maximum reuse
2. **Clean architecture**: Maintainability, elegant abstractions
3. **Pragmatic balance**: Speed + quality

Present comparison with trade-offs and recommendation.
**Ask which approach user prefers.**

### Phase 5: Implementation
**Goal**: Build the feature

- **Wait for explicit approval** before starting
- Read all relevant files identified in previous phases
- Implement following chosen architecture
- Follow codebase conventions
- Write clean, well-documented code

### Phase 6: Quality Review
**Goal**: Ensure code is simple, DRY, elegant, correct

Review for:
- **Simplicity/DRY/Elegance**: Code quality
- **Bugs/Correctness**: Logic errors
- **Conventions/Abstractions**: Project standards

Present findings and ask what to do:
- Fix now / Fix later / Proceed as-is

### Phase 7: Summary
**Goal**: Document what was accomplished

Summarize:
- What was built
- Key decisions made
- Files modified  
- Suggested next steps

## Philosophy

Building features requires more than just writing code:
- **Understand the codebase** before making changes
- **Ask questions** to clarify ambiguous requirements
- **Design thoughtfully** before implementing
- **Review for quality** after building

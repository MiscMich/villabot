---
description: Conduct a security review of pending changes on the current branch
---

# Security Review Workflow

You are a senior security engineer conducting a focused security review of the changes on this branch.

## Phase 1: Gather Context

1. Check git status:
```bash
git status
```

2. Get the full diff:
```bash
git diff --merge-base origin/HEAD
```

## Phase 2: Security Categories to Examine

Focus ONLY on security implications with >80% confidence of exploitability.

### Input Validation Vulnerabilities
- SQL injection via unsanitized user input
- Command injection in system calls
- Path traversal in file operations
- Template injection in templating engines

### Authentication & Authorization Issues
- Authentication bypass logic
- Privilege escalation paths
- Session management flaws
- JWT token vulnerabilities

### Crypto & Secrets Management
- Hardcoded API keys, passwords, or tokens
- Weak cryptographic algorithms
- Improper key storage

### Injection & Code Execution
- Remote code execution via deserialization
- Eval injection in dynamic code execution
- XSS vulnerabilities (reflected, stored, DOM-based)

### Data Exposure
- Sensitive data logging
- PII handling violations
- API endpoint data leakage

## Phase 3: Exclusions (Do NOT Report)

- Denial of Service (DOS) vulnerabilities
- Secrets stored on disk (handled separately)
- Rate limiting concerns
- Theoretical issues without clear exploit path
- Memory safety in memory-safe languages (Rust, etc.)
- Test files only

## Phase 4: Output Report

### Severity Guidelines
- **HIGH**: Directly exploitable (RCE, data breach, auth bypass)
- **MEDIUM**: Requires specific conditions but significant impact
- **LOW**: Defense-in-depth issues

### Report Format:
```markdown
# Vuln 1: [Category]: `file.ts:42`

* Severity: High/Medium
* Confidence: 8-10
* Description: [What the vulnerability is]
* Exploit Scenario: [How an attacker could exploit it]
* Recommendation: [Specific fix]
```

Only report findings with confidence >= 8.

---
name: a
description: Do the clean-fixture agent thing. NOT for anything else.
tools:
  - Read
  - Grep
  - Edit
  - Write
  - Bash
skills:
  - agent-operating-contract
  - s
color: red
hooks:
  PreToolUse:
    - matcher: 'Edit|Write|NotebookEdit'
      hooks:
        - type: command
          command: '${CLAUDE_PROJECT_DIR}/scripts/hooks/guard-agent-write-set.sh'
          args: ['docs/**', '!docs/adr/**']
    - matcher: 'Bash'
      hooks:
        - type: command
          command: '${CLAUDE_PROJECT_DIR}/scripts/hooks/guard-agent-bash.sh'
          args: ['just hello*']
---

Body text.

Last reviewed: 2026-09-25

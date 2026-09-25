---
name: narrow
description: Do the narrow fixture agent thing. NOT for anything else.
tools: Read, Edit, Write
color: blue
skills: [agent-operating-contract]
hooks:
  PreToolUse:
    - matcher: 'Edit'
      hooks:
        - type: command
          command: '${CLAUDE_PROJECT_DIR}/scripts/hooks/guard-agent-write-set.sh'
          args: ['docs/**', '!docs/adr/**']
---

Body text.

Last reviewed: 2026-09-25

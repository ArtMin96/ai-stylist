---
name: b
description: Do the b fixture agent thing. NOT for anything else.
tools: Read, Grep, Bash
skills: [agent-operating-contract]
color: 'purple'
hooks:
  PreToolUse:
    - matcher: 'Bash'
      hooks:
        - type: command
          command: '${CLAUDE_PROJECT_DIR}/scripts/hooks/guard-agent-bash.sh'
          args: ['just hello*']
---

Body text.

Last reviewed: 2026-09-25

---
name: posthook
description: Do the posthook fixture agent thing. NOT for anything else.
tools: Read, Bash
color: blue
skills: [agent-operating-contract]
hooks:
  PostToolUse:
    - matcher: 'Bash'
      hooks:
        - type: command
          command: '${CLAUDE_PROJECT_DIR}/scripts/hooks/guard-agent-bash.sh'
          args: ['just hello*']
---

Body text.

Last reviewed: 2026-09-25

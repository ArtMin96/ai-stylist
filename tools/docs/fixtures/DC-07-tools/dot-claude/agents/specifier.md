---
name: specifier
description: Do the specifier fixture agent thing. NOT for anything else.
tools: Read, Bash(just:*)
color: green
skills: [agent-operating-contract]
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

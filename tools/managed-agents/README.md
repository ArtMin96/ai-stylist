# Managed Agents: capture camera engineer

A Claude Managed Agent that carries on the guided capture camera work (PR #56) without a Claude Code
session open. Anthropic runs the agent's reasoning; every command it runs executes **on this Mac**
through a small worker, because the work needs Xcode, the iOS Simulator, the Android emulator and
Maestro. The owner approved giving the agent the repository on 2026-10-22.

## Files

| File                                     | What it is                                                                                                          |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `agents/capture-camera/agent.md`         | The agent: model (Claude Opus 5.5, effort high), tools, and its standing instructions (frontmatter + system prompt) |
| `agents/capture-camera/environment.yaml` | A self-hosted environment: tools run on this Mac, not in Anthropic's cloud                                          |
| `agents/capture-camera/kickoff.md`       | The default first message of a session: fix PR #56's CI, run the two final `just capture-sim` passes, hand off      |
| `capture-agent.sh`                       | What `just capture-agent` runs                                                                                      |
| `claude-lock.json`                       | Written by `ant apply` on the first run; records the agent and environment IDs. Commit it                           |

## One-time setup (about 5 minutes)

1. Install the Anthropic CLI and log in:
   ```sh
   brew install anthropics/tap/ant
   xattr -d com.apple.quarantine "$(brew --prefix)/bin/ant"
   ant auth login
   ```
2. Run `just capture-agent`. The first run shows the plan for the new agent and environment and asks
   to create them: answer `y`. It then stops, because the worker needs a key.
3. In the Anthropic Console, open the environment `capture-camera-mac` and choose "Generate environment
   key". Store it in the Keychain (it prompts for the key; nothing is written to disk):
   ```sh
   security add-generic-password -a "$USER" -s ai-stylist-capture-agent-environment-key -w
   ```

## Every run

```sh
just capture-agent                    # start a session with the default kickoff message
just capture-agent start my-task.md   # start a session with your own first message
just capture-agent stop               # stop the worker on this Mac
```

`just capture-agent` syncs the agent, starts the worker in the background (log:
`artifacts/managed-agents/worker.log`), opens a session and attaches your terminal to it. In the
terminal view: type and Enter sends a message, Esc interrupts the agent, Ctrl+C detaches (the session
keeps running). Reattach later with `ant beta:sessions connect <session-id>`, or add `--web` to watch it
in the browser. The worker must keep running while a session works; `just capture-agent stop` ends it.

## Spending cap

The owner's cap is **$197 in total** (2026-10-22). Each session gets a hard budget of whatever is left:
$197 minus the list cost of every earlier session whose title starts with `capture-camera:`. A session
that reaches its budget pauses (nothing is lost); the next `just capture-agent` refuses to start once
the total is used up. List cost counts model tokens at list price, web searches, and session running
time ($0.08 per hour). Change the total with `CAPTURE_AGENT_TOTAL_CENTS=<cents> just capture-agent`.

## What the agent can and cannot do

- It works in `.claude/worktrees/capture-camera` on `feat/capture-camera`, may push there and to new
  branches, and never pushes to `main`, merges, force-pushes or deletes branches.
- Tool calls run as your macOS user, with `--unrestricted-paths`, so it can reach the simulators,
  `~/.maestro` and the scratch folders. Its instructions forbid reading `.git/account/`, the Keychain,
  `~/.config/anthropic/`, `~/.ssh/` and `.env` files, and the worker runs without your Anthropic API key
  or PostHog keys in its environment. Treat it like a colleague with access to this Mac: watch the first
  session.
- Tool calls are evaluated by Anthropic's `auto` permission policy: routine calls run, high-risk ones are
  refused, and unclear ones pause for your yes or no in the attached terminal.
- Real phones are not attached; device-only checks stay on the device-only list.

## Not yet verified

This setup was written from the Managed Agents documentation; nothing has run yet because `ant` was not
installed. Check on the first run: the `--budget` flag of `ant beta:sessions create`, the
`--max-idle 12h` worker flag (`ant beta:worker poll --help`), and that `usage.list_cost.amount` in
`ant beta:sessions list` gives each session's cost. If any of these fails, the script stops with an
error before spending anything.

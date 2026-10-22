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

## Installation (once per Mac, about 10 minutes)

You need a Mac that already runs the repo's checks (`just doctor`, Xcode, the Android SDK and Maestro),
[Homebrew](https://brew.sh), and an Anthropic account with API credit.

1. **Install the Anthropic CLI (`ant`) and `jq`:**
   ```sh
   brew install anthropics/tap/ant jq
   xattr -d com.apple.quarantine "$(brew --prefix)/bin/ant"
   ant --version   # 2.1.0 or later
   ```
2. **Log in to your Anthropic account** (opens the browser once; the login is stored in
   `~/.config/anthropic/`):
   ```sh
   ant auth login
   ant auth status   # shows the active profile
   ```
3. **Create the agent and its environment.** In the repository's main folder, check out the camera
   branch and run the command (the recipe exists only on that branch):
   ```sh
   git switch feat/capture-camera
   just capture-agent
   ```
   It prints the plan (one agent, one environment) and asks to create them: answer `y`. It writes
   `tools/managed-agents/claude-lock.json` (commit it), then stops with "no environment key in the
   Keychain". That stop is expected.
4. **Give the worker its key.** In the Anthropic Console (platform.claude.com), open Managed Agents →
   Environments → `capture-camera-mac` and choose "Generate environment key". Copy the key
   (`sk-ant-oat01-…`) and store it in the macOS Keychain (the command prompts for it; nothing is
   written to disk):
   ```sh
   security add-generic-password -a "$USER" -s ai-stylist-capture-agent-environment-key -w
   ```
5. **Start the first session:** run `just capture-agent` again. From now on that one command is all
   you need.

To remove the key later: `security delete-generic-password -s ai-stylist-capture-agent-environment-key`.

## Every run

Run these from the repository's main folder with `feat/capture-camera` checked out:

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
$197 minus the list cost of every earlier session of this agent whose title starts with
`capture-camera:`. A session that reaches its budget pauses (nothing is lost); the next
`just capture-agent` refuses to start once the total is used up. List cost counts model tokens at list
price, web searches, and session running time ($0.08 per hour). Change the total with
`CAPTURE_AGENT_TOTAL_CENTS=<cents> just capture-agent`.

## What the agent can and cannot do

- It works on `feat/capture-camera` in the repository's main folder, may push there and to new
  branches, and never pushes to `main`, merges, force-pushes or deletes branches.
- Tool calls run as your macOS user from the repository's main folder (the worker's `--workdir`), so it
  reaches every worktree, the simulators and Maestro. Its instructions forbid reading `.git/account/`,
  the Keychain, `~/.config/anthropic/`, `~/.ssh/` and `.env` files, and the worker runs without your
  Anthropic API key or PostHog keys in its environment. Treat it like a colleague with access to this
  Mac: watch the first session.
- Tool calls are evaluated by Anthropic's `auto` permission policy: routine calls run, high-risk ones are
  refused, and unclear ones pause for your yes or no in the attached terminal.
- Real phones are not attached; device-only checks stay on the device-only list.
- The worker stops serving a session 12 hours after it goes idle (`--max-idle 12h`); `just capture-agent`
  restarts it.

Flags checked against `ant` 2.1.0 (`--help`) on 2026-10-22: `beta:sessions create --budget`,
`beta:sessions list --agent-id --max-items`, `beta:worker poll --environment-id --workdir --max-idle`.
Not yet run end to end: the first real session.

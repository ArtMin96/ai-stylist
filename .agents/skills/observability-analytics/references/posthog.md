# PostHog — reference

> A reference file inside `observability-analytics`, not a standalone skill. Open it when a task
> touches the PostHog account itself: which host or key a piece of code needs, a key's scopes, what
> `just observability-sync` reads and writes there, the life of a feature flag, symbol upload, or a
> free-plan limit. How the apps and the API use PostHog is in `docs/observability/posthog.md`.

Last reviewed: 2026-10-03

## How to read this file

Words used below, for a reader who has never used PostHog:

- An **organization** holds **projects**. A project is one separate set of events, flags and
  settings.
- The **project token** identifies the project to PostHog when an app sends data. It can only send;
  it cannot read or change anything. Older texts call it the "project API key".
- A **personal API key** acts as the person who made it, limited by the **scopes** chosen for it.
  It can read and change things, so it is a secret.
- A **feature flag** is a named switch that PostHog evaluates and the code asks about.
- A **symbol file** (a dSYM on iOS, an R8 mapping on Android) lets PostHog turn the addresses and
  shortened names in a crash report back into readable function names. **Symbol upload** sends
  those files at build time.
- A **transformation** is a small function PostHog runs on each incoming event. PostHog's internal
  name for it is a "hog function".

Every statement about the vendor says how it is known:

- **[live]**: seen in the live PostHog screens, or returned by a read-only request, on 2026-10-03.
- **[doc N]**: stated on an official PostHog page, or in PostHog's own published source code,
  fetched on 2026-10-03. N is the number in [Sources](#sources). A screen label that is known only
  from source code says so, because the live screen may word it differently.
- **[repo]**: follows from this repository's code. The sentence names the file.
- **[unconfirmed]**: none of the above. Treat it as an open question, never as a fact, and do not
  upgrade it without new evidence.

Where the live screens and the official pages disagreed, the live screens are recorded here and the
difference is stated.

## Rules

1. **The repository wins.** A vendor skill or plugin, or a vendor page, may disagree with this
   repository's contract: root `CLAUDE.md`, `docs/observability/posthog/README.md`, the flag
   registry `packages/shared-kernel/registry/feature-flags.json`, the sync in
   `tools/observability/`. Follow the repository and report the difference in your hand-back. Do
   not follow the vendor text. Three cases that already exist:
   - PostHog's index for AI assistants tells them to set PostHog up with its setup wizard and
     offers a plugin and an MCP server [doc 10]. Here the SDKs are already wired behind a
     consent-gated port, the wizard would write into `CLAUDE.md` and `.agents/skills/` (both
     human-only), and `just` is the only entry point.
   - The same index gives the ingestion host as "the PostHog API base URL" for use with a personal
     key [doc 10]. The API page says private endpoints use the app host [doc 1], and that is what
     this repository does. See [Two hosts](#two-hosts).
   - PostHog's flag skills create, change and clean up flags directly. Here a flag exists only
     because the registry declares it, and only a human switches it on.
2. **An agent never does any of these**, whatever a vendor skill suggests:
   - run `just observability-sync` as a real run, or with `--dry-run`, without the owner's
     authorization for that run. Both use the stored key. `--check` is offline and always allowed;
   - call a PostHog write API directly: any POST, PATCH or DELETE with a personal key, through a
     command-line tool, an MCP server or a script;
   - read or edit `.env` or anything under `secrets/**`;
   - change anything in the PostHog screens: a flag's state or rollout, a project setting, a
     transformation, a key, the project token.
3. Creating, storing and replacing keys is a human task: the owner creates the key in the PostHog
   screens, stores it with `just secrets-edit dev` and loads it with `just secrets-sync`. An agent
   prepares the steps and stops.

## The account as it exists

| What                                          | Value                                | Known from                                             |
| --------------------------------------------- | ------------------------------------ | ------------------------------------------------------ |
| Region                                        | US Cloud                             | [live]                                                 |
| Organization                                  | "Garderi Test" (the only one)        | [live]                                                 |
| Project                                       | "Default project" (the only one)     | [live]                                                 |
| Numeric project id (`POSTHOG_CLI_PROJECT_ID`) | `630358`                             | [live]                                                 |
| Owner's access                                | organization Owner, so project admin | [live], read from the API, not from the Members screen |

The **Region** box sits beside the project token on the project settings screen and reads "US
Cloud" [live]. The browser address (`us.posthog.com`) says the same. The repository's decision
records (ADR-0007, DEC-58) assume US; OQ-07 on data residency is still open.

## Two hosts

PostHog has two addresses per region, and each key belongs to exactly one of them. US Cloud:

| Host                       | What it is                                                                    | Env key            | Used by                                                |
| -------------------------- | ----------------------------------------------------------------------------- | ------------------ | ------------------------------------------------------ |
| `https://us.i.posthog.com` | ingestion: the public endpoints that receive events and answer flag questions | `POSTHOG_HOST`     | the iOS and Android SDKs; the API's flag evaluation    |
| `https://us.posthog.com`   | the app and the private API                                                   | `POSTHOG_CLI_HOST` | symbol upload (posthog-cli); `just observability-sync` |

- The official statement: "On US Cloud, these are `https://us.i.posthog.com` for public endpoints
  and `https://us.posthog.com` for private ones" [doc 1]. The SDK snippet on the project settings
  screen shows the ingestion host [live].
- Swapped, nothing errors loudly: events vanish, or the upload and the sync fail.
- Which code reads which key is [repo]: `apps/api/src/config.ts` (the API refuses a key without a
  host), `tools/observability/sync.mjs` (the sync requires an https address),
  `apps/ios/scripts/xcode.sh` and `apps/android/app/build.gradle.kts` (the uploads).

## The keys

| Env key                | What it is                                 | Value starts with | Rights                                                                      | Lives in                                                    |
| ---------------------- | ------------------------------------------ | ----------------- | --------------------------------------------------------------------------- | ----------------------------------------------------------- |
| `POSTHOG_API_KEY`      | the project token                          | `phc_`            | none to choose; send-only                                                   | sops dev, then `.env`. Never in GitHub                      |
| `POSTHOG_CLI_API_KEY`  | personal key labelled `symbol-upload`      | `phx_`            | `organization:read`, `error_tracking:write`; access **Organizations**       | sops dev, then `.env`; also a GitHub secret                 |
| `POSTHOG_SYNC_API_KEY` | personal key labelled `observability-sync` | `phx_`            | `project`, `feature_flag`, `hog_function` at **Write**; access **Projects** | sops dev, then `.env`. Never in GitHub. **Not created yet** |

An account can hold up to 10 personal keys [doc 2]. Before 2026-10-03 this account had none
[live]. A later task (P03) adds one more personal key for the deletion adapter; its env name does
not exist yet (`docs/SERVICES-SETUP.md` §10).

### The project token (`POSTHOG_API_KEY`)

- On the screen it is the box **Project token** under the heading **Project token & ID**, with the
  note "Integrations often call the token your project API key." [live]. The boxes **Project ID**
  and **Region** are beside it [live].
- It is public by design: the docs say it is fine for the token to be public [doc 1], and it is
  compiled into the apps. It still never goes into a committed file or into GitHub, so that
  CI-built apps send nothing [repo] `docs/observability/posthog.md`.
- The icon beside it resets the token and invalidates the current one at once [doc 11]. Nobody
  clicks it without a decision: every installed app build would stop sending.
- [repo] The API accepts only a value that matches `^phc_\w+$` and refuses a personal key
  (`apps/api/src/config.ts`); the iOS build script and the Android build do the same
  (`apps/ios/scripts/xcode.sh`, `apps/android/app/build.gradle.kts`).

### The symbol-upload key (`POSTHOG_CLI_API_KEY`)

- Created on 2026-10-03 with the label `symbol-upload` [live].
- **Access mode: Organizations**, with the organization ticked. The screen describes the mode as
  "This will only allow access to selected organizations and all projects within them." [live].
  It cannot be **Projects**: on a project-scoped key the Organization scope is unavailable
  [doc 11].
- **Scopes:** the preset **Source map upload** sets exactly Error tracking at Write and
  Organization at Read. After creation the key's row shows `organization:read` and
  `error_tracking:write` [live].
- **Why these two:** both upload pages ask for a "Personal API key with `error tracking write` and
  `organization read` scopes" [doc 6] [doc 7]. Whether the pinned command-line tool really uses
  `organization:read` is [unconfirmed]; follow the docs.
- **Checked** [live]: `GET https://us.posthog.com/api/organizations/@current/` returned 200, and
  `GET https://us.posthog.com/api/projects/630358/feature_flags/` returned 403. The 403 is the
  proof that this key cannot touch flags, which is the point of keeping it separate: it is the only
  PostHog secret CI holds.

### The sync key (`POSTHOG_SYNC_API_KEY`)

**This key did not exist on 2026-10-03.** Its form was partly filled and never submitted [live].
Everything below is the plan, with its evidence.

- **Label:** `observability-sync`. No key with that label exists, so no dated suffix is needed
  [live].
- **Access mode: Projects**, with "Default project" ticked. The screen describes the mode as "This
  will only allow access to selected projects." and listed that one project [live].
- **Scopes:** Project, Feature flag and Hog function, each at **Write**; nothing else. The three
  row labels come from PostHog's frontend source [doc 11]. They were **not reached in the live
  screen**, so their exact wording there is [unconfirmed]. No preset sets this combination; use the
  **Search scopes…** box [live].
- **Why Write only:** each row offers one choice of **No access**, **Read** or **Write** [live],
  and PostHog's source says a write scope covers the matching read [doc 11]. The repository's docs
  list six scope names (`project:read`, `project:write` and so on); that is the same thing spelled
  out. Scope names in that form appear only in the key list after creation, not in the form
  [live].
- **Why the owner must be a project admin:** PostHog refuses a non-admin with "Only project admins
  can modify these settings" for `anonymize_ips`, `autocapture_opt_out`, `heatmaps_opt_in`,
  `capture_console_log_opt_in` and `capture_performance_opt_in` [doc 11], and the sync always sends
  the whole settings object [repo]. An organization owner is a project admin automatically
  [doc 4].
- **Untested:** whether a project-scoped key is accepted on the project read and update calls. The
  source suggests yes. If the owner's dry run answers 403 on that call, the fix is to change the
  key's access mode to **Organizations** [unconfirmed].
- **Never a GitHub secret.** It can change settings and flags; a build needs neither.

## Click path walked on 2026-10-03

All labels below are [live]. They are recorded so a human can repeat them; an agent does not click
them (Rules).

1. Open `https://us.posthog.com/settings/project`. It lands on **Settings - General**, section
   **Project token & ID**, with the boxes **Project token**, **Project ID** and **Region**.
2. Open `https://us.posthog.com/settings/user-api-keys`. In the settings sidebar this is
   **Account** → **Personal API keys**; the page title is **Settings - Personal API keys**.
3. Click **Create personal API key**. A dialog with the same title opens.
4. Type the name in **Label**.
5. Under **Organization & project access** choose one of **All access**, **Organizations** or
   **Projects**. For **Organizations**, click **Select organizations…** and tick the organization;
   for **Projects**, click **Select projects…** and tick the project. Click the dialog's title to
   close the list.
6. Under **Scopes**, either click **Select preset** and choose one, or set single rows. Each row
   has **No access**, **Read** and **Write**, and there is a **Search scopes…** box. The presets
   listed are Source map upload, Local feature flag evaluation, Zapier integration, n8n
   integration, Performing analytics queries, Endpoint execution, Project & user management, MCP
   Server, Agent CLI, Read-only access and All access.
7. Click **Create key**. A dialog titled **Personal API key ready** shows the value once, with the
   text "the value above will never be shown again".
8. Copy the value, then click **Okay**.

For the sync key the walk stopped inside step 5: the label was typed, **Projects** was chosen and
the project list was open. Steps 5 (ticking the project), 6, 7 and 8 remain, and none of the three
scope rows was seen.

Differences from the official page: it calls the button "+ Create a personal API Key" and does not
mention the access mode [doc 2]. The live labels win. PostHog's source adds that the form will not
submit until an access mode is chosen [doc 11].

## What the sync reads and writes in PostHog

[repo] `tools/observability/posthog.mjs`, sent by `tools/observability/http.mjs` with
`Authorization: Bearer <key>`. Every path starts with `/api/projects/<project id>`.

| Step            | Read (scope needed)                                                          | Write (scope needed), only when something differs                                                                       |
| --------------- | ---------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Settings        | `GET` of the project (`project:read`)                                        | `PATCH` of the project with the whole `project` object of the settings file (`project:write`)                           |
| Transformations | `GET` of the hog functions of type transformation (`hog_function:read`)      | `PATCH` of one function with `{"enabled": false}` (`hog_function:write`)                                                |
| Flags           | `GET` of the flag list, and again with `archived=true` (`feature_flag:read`) | `POST` of a new flag; `PATCH` of a flag's name; with `--prune`, `PATCH` with `{"deleted": true}` (`feature_flag:write`) |

- The settings come from `docs/observability/posthog/project-settings.json`: IP addresses
  discarded, exception capture on, session replay, surveys, heatmaps, autocapture, console-log and
  performance capture off, and the GeoIP transformation (`template-geoip`) disabled.
- The sync sends no `DELETE`. It never changes a flag's `active` or `filters`: turning a flag on is
  a human decision.
- A 403 on the transformation calls does not fail the run. The sync prints the manual step instead
  (Data pipelines, Transformations, GeoIP, disable). That screen path is in the code's message and
  was not walked [unconfirmed].
- A registry key whose flag is archived in PostHog is reported as a warning and not created again.
- `--check` sends nothing. `--dry-run` sends the reads only and prints each write it would send.
- The scope named beside each call is from PostHog's API reference [doc 12].
- **A path PostHog does not document.** The public API reference documents reading and updating a
  project only under the organization (`/api/organizations/<organization id>/projects/<id>/`). The
  shorter path the sync uses is marked as hidden from the API docs but used by PostHog's own app
  [doc 11]. It works today; if the settings step starts failing with 404, this is the first thing
  to check. `docs/observability/posthog/README.md` calls the shorter path "canonical", which the
  vendor does not say.

## The life of a feature flag

Flags gate rollouts and experiments only, never a paid capability. The registry
`packages/shared-kernel/registry/feature-flags.json` is the only place a flag is declared. Policy:
`.agents/skills/release-readiness/references/feature-flags-rollout.md`. Steps for a developer:
`docs/observability/posthog.md`.

1. **Declare.** A registry entry carries owner, purpose, kind, creation and expiry dates, rollout
   plan, the behaviour when off, and `defaultWhenUnavailable`. The package is single-writer
   (`contracts-engineer`).
2. **Create in PostHog.** The owner runs `just observability-sync`. A new flag is created
   **inactive, at 0 %**, named `<purpose> [registry: owner <person id>, <kind>, expires <date>]`
   [repo]. That name tag is how the sync recognises its own flags later.
3. **Ask in code.** `featureFlags.isEnabled('<key>')` through the port; the key type comes from the
   registry, so a typo fails `just typecheck`.
4. **Roll out.** A human, in the PostHog screens, following the entry's rollout plan. Because the
   flag was created at 0 %, switching it on is not enough: the release condition must be raised as
   well [repo]. The screen names come from PostHog's source and were not walked: open the flag at
   `https://us.posthog.com/feature_flags`, switch **Enable feature flag**, edit **Release
   conditions**, then **Save** [doc 11].
5. **Report.** `just flags-report` lists every flag with owner and days left, and exits 1 when a
   rollout or experiment flag is past its expiry. The nightly job `expired-flags` in
   `.github/workflows/nightly.yml` runs it.
6. **Retire.** Remove the last check and the registry entry in one change. After the merge the
   owner runs the sync with `--prune`, which soft-deletes the flag. A key is never renamed or
   reused.

How the API reads a flag, [repo] `apps/api/src/platform/feature-flags/README.md`:

- one remote request for all registry flags, cached for 10 seconds, so a change in PostHog reaches
  the API within about 10 seconds;
- a flag that is inactive or missing in PostHog reads as **off**;
- only when PostHog cannot answer (timeout, error, or the monthly quota used up) does the flag take
  its `defaultWhenUnavailable`;
- with an empty `POSTHOG_API_KEY` no request is made and every flag takes that default.

The registry holds one flag today, `demo-outbox-flow` (expires 2026-12-26, default when
unavailable: on). When it is off, `POST /v1/dev/demo-events` answers 404; when on, 202 [repo].
Once the monthly flag-request allowance is used up, PostHog answers with a quota-limited response
[doc 8], the default applies, and switching that flag off stops having an effect.

## Symbol upload

Both uploads run the command-line tool posthog-cli, version 0.18.7, pinned in `mise.toml`. It reads
`POSTHOG_CLI_API_KEY`, `POSTHOG_CLI_PROJECT_ID` and `POSTHOG_CLI_HOST` [doc 13], the same names the
repository uses. **Each upload runs only when all three are set**; otherwise the build succeeds and
uploads nothing.

| Platform | What starts it                                               | What runs                                                                                                               | Sign that it ran                              | Sign that it was skipped                                 |
| -------- | ------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- | -------------------------------------------------------- |
| iOS      | `just ios-build` on a Mac                                    | `apps/ios/scripts/xcode.sh` calls the upload script shipped inside posthog-ios, which runs `posthog-cli dsym upload`    | a line starting `==> dSYM upload to PostHog:` | a line starting `ios-build: notice: dSYM upload skipped` |
| Android  | `just android-build preview` or `just android-build release` | the PostHog Gradle plugin's task `uploadPostHogProguardMappings<Variant>`, which runs `posthog-cli exp proguard upload` | the task is listed as executed                | the task is listed as `SKIPPED`                          |

- In CI the iOS and Android workflows pass the three values on `main` only; pull requests upload
  nothing [repo] `.github/workflows/ios.yml`, `.github/workflows/android.yml`.
- `just doctor` checks that posthog-cli is on the path.
- As of 2026-10-03 no upload has run with the new key: its row shows "Last used: Never" [live].

How to tell that an upload worked, beyond the build output:

- **Symbol sets.** `https://us.posthog.com/error_tracking/configuration#selectedSetting=error-tracking-symbol-sets`
  lists what was uploaded; a missing set is listed with a reason [doc 6]. How to reach that screen
  by clicking is [unconfirmed]; use the address.
- **A real crash.** Force the test crash as the app READMEs describe. On iOS the stack must show
  the `forceTestCrash()` frame; on Android it must show `app.aistylist.app.ForcedTestCrash` thrown
  from `throwForcedTestCrash`, called by `HomeViewModel.forceTestCrash` [repo]
  `apps/ios/README.md`, `apps/android/README.md`. The crash appears at
  `https://us.posthog.com/error_tracking`, on the issue's **Stacktrace** tab [doc 6].
- The docs describe no mark that says "symbolicated" [unconfirmed]; readable function names are
  the evidence.
- Expected on iOS: "Swift crashes appear as `SIGTRAP` without the actual error message", and
  system frames are not symbolicated [doc 6]. A crash is sent only on the next launch, with consent
  on again, and never while a debugger is attached [repo] `apps/ios/README.md`.

Things that break quietly:

- The Android upload uses a hidden alias of the command-line tool that its source marks for removal
  [doc 13]. Re-check it on every posthog-cli or Gradle plugin bump.
- The iOS upload script prefers a posthog-cli installed in the user's home directory over the one
  on the path, so a manually installed copy on the Mac overrides the pin [doc 13].
- The tool's `api` subcommands also read `POSTHOG_HOST` and `POSTHOG_API_KEY`, which here hold the
  ingestion host and the project token. Do not run them from the project shell [doc 5].

## Free-plan limits that matter here

| Limit                                                                 | Why it matters in this repository                                                             | Known from |
| --------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- | ---------- |
| 1 project                                                             | the production project planned for P03 needs the paid plan or a second organization           | [doc 9]    |
| 1 year of data retention                                              | fine for launch                                                                               | [doc 9]    |
| 1,000,000 events a month                                              | only consent-gated events are sent                                                            | [doc 9]    |
| 1,000,000 flag requests a month                                       | the API asks once per 10 seconds while it runs, about 260,000 a month per running API process | [doc 9]    |
| 100,000 exceptions a month                                            | crash reports count here                                                                      | [doc 9]    |
| 5,000 session recordings a month                                      | unused: replay is off                                                                         | [doc 9]    |
| 10 personal API keys per account                                      | two are planned now, a third in P03                                                           | [doc 2]    |
| moving a project to another region needs the Scale or Enterprise plan | an EU requirement (OQ-07) means a new organization and project on EU Cloud, not a move        | [doc 3]    |

The flag-request estimate is arithmetic on the 10-second cache [repo], not a measured number.
Leaving the free plan is an ADR, not a setting to change (the skill's "Stop / escalation").

## Vendor material an agent may read

- `https://posthog.com/llms.txt` indexes the documentation. Any docs page comes as Markdown when
  `.md` is appended to its address [doc 10].
- The official `posthog` plugin and the hosted MCP server at `https://mcp.posthog.com/mcp` are
  **not** set up here. Their tools can update project settings, flags and transformations, which
  are the three things the sync owns, and the plugin's own confirmation prompt does not cover
  settings or transformation writes [doc 14]. Adding either needs an ADR (planning doc 15 §12.5).
- Rule 1 applies to all of it.

## Where this repository's docs differ from what was seen

These are recorded so nobody follows the stale line. The files are outside this skill; their owners
apply the fix.

- `docs/SERVICES-SETUP.md` §10 names the organization `ai-stylist` and the project
  `ai-stylist-dev`. They are "Garderi Test" and "Default project" [live].
- It calls the token "Project API key". The label is **Project token** [live].
- It lists scopes as six names and says "limited to the project". The form has named rows with
  three choices and an access mode [live].
- It does not mention the preset **Source map upload** or that the upload key must use the access
  mode **Organizations** [live] [doc 11].
- It, and `docs/observability/posthog.md`, say a region "cannot change". PostHog moves a project
  between regions for Scale and Enterprise customers only [doc 3].
- They plan a second project for production without noting the free plan's limit of one [doc 9].
- `docs/observability/posthog/README.md` says the sync does not request archived flags yet. It
  does [repo] `tools/observability/posthog.mjs`; `tools/observability/README.md` already says so.
- `docs/observability/posthog.md` calls the nightly `expired-flags` job a placeholder. The job in
  `.github/workflows/nightly.yml` already runs `just flags-report` [repo].
- Code comments in `apps/api/src/config.ts` and under `apps/api/src/platform/feature-flags/` use
  the EU host as their example. The project is on US Cloud.

## Sources

Fetched on 2026-10-03:

1. `https://posthog.com/docs/api`
2. `https://posthog.com/docs/api/personal-api-keys`
3. `https://posthog.com/docs/settings/projects`
4. `https://posthog.com/docs/settings/access-control`
5. `https://posthog.com/docs/cli`
6. `https://posthog.com/docs/error-tracking/upload-source-maps/ios` and the iOS error-tracking
   installation page it links
7. `https://posthog.com/docs/error-tracking/upload-mappings/android`
8. `https://posthog.com/docs/api/flags` and the feature-flag cost page's section "Quota limiting"
9. `https://posthog.com/pricing`
10. `https://posthog.com/llms.txt`
11. PostHog's application source, repository `https://github.com/PostHog/posthog`, branch master:
    the settings screen (`TeamSettings.tsx`), the scope list and key table of the personal API key
    screens (`scopes.tsx`, `APIKeyTable.tsx`), the feature flag screens, and the server files for
    scopes (`scopes.py`), project settings (`team.py`) and the project endpoint (`project.py`)
12. PostHog's API reference, the pages for listing, creating and updating feature flags, listing
    and updating hog functions, and reading and updating a project
13. The command-line tool's source at the tag of version 0.18.7 (its authentication and command
    files), and the upload script shipped with posthog-ios 3.85.0
14. `https://posthog.com/docs/model-context-protocol/faq` and the plugin repository
    `https://github.com/PostHog/ai-plugin`

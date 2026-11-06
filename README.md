# DSH Workbench

A small Cordis bundle for DeepSeek Harness that puts a **Workbench** tab in the conversation's right sidebar. It answers one question at a time, in three moments: **接上 / Attach** (where did this project stop, and what is this session for), **在做 / Working** (what is happening right now — this session and any dispatched run), and **收工 / Close out** (what was produced, and what does the next session need to know). The moment is derived from data, not chosen by the user: a live run wins, then an unclosed gap, else attach. Short work is queued into the session the panel is attached to (`POST /api/sync`); long work becomes its own dispatched session. Memory is one JSON record per project, and every write regenerates a bounded `AGENTS.md` block, so a model receives the continuity with no custom prompt code. Run records are digested into conclusion / artifacts / open questions / stats with the raw reply kept behind a disclosure. It never calls a provider directly and never bypasses DSH permissions or the session lifecycle.

## Features

- Adds a `Workbench` tab **in the right sidebar**, scoped to the conversation it is opened from. It registers a right-sidebar tab type (`kind: 'workbench'`, one guide entry) and renders into `sidebar.right.pane.tab`, so it never replaces the chat column; the slot injects the session id, which is what makes "do this in *this* session" possible.
- Three moments instead of five tabs, auto-selected from data: **Attach** (project memory, "this task", the channel verdict, and the dispatch form folded away), **Working** (current session progress polled from `GET /api/live`, the current dispatched run, canvas behind a disclosure), **Close out** (next step + outcome + decision form, then the run report). A manual click overrides the choice until the ↺ chip restores auto-selection.
- Two execution channels decided by the Host before any click (`POST /api/channel`): a short task (≤2 min, no external generation) stays in the same session and is queued with `POST /api/sync`; anything long (<2 min / needs generated media / waits on an outside resource / user is leaving) is refused in place with the reason and dispatched as its own session. The button is disabled — not silently redirected — and the dispatch form opens by itself.
- Provides a command-center draft form for goal, plan, instruction, and model; preview composes the exact prompt and shows whether dispatch is available.
- Dispatches one instruction into a real DSH Session via `POST /dsh-workbench/api/dispatch` (Host `sessionController.create` → optional `selectModel` → `prompt`), with `GET /dsh-workbench/api/runs` for status/reply and `POST /dsh-workbench/api/runs/cancel` for cancellation. Dispatch is opt-in per workspace (`execution.enabled`), never silent, and audited.
- Session targeting: `POST /api/dispatch` accepts an optional `sessionId`. When present it prompts that existing session (keeping its history and approvals) instead of creating a new one; `GET /api/sessions` lists dispatchable sessions with titles read from `session/title` events.
- Reusable module library (`GET`/`POST /dsh-workbench/api/modules`, stored in `modules.json`): each goal/plan/instruction slot can be filled from a saved module, saved back as one, and modules used by a dispatch get their use counter bumped — the raw material for assembling task templates and, later, a canvas.
- Task templates (`GET`/`POST /dsh-workbench/api/templates`, stored in `templates.json`): a template is a saved recipe — the three slots, the module ids it was assembled from, the default model and session mode. Selecting one fills every slot in a single action; saving one records the current combination; dispatch carries `templateId`, records `templateId`/`templateTitle` on the run, inherits the template's module ids when the caller sent none, and bumps the template use counter. A stale template id never blocks work: dispatch proceeds and reports `templateMissing`.
- Orphaned-run handling: after a Harness restart a run's session may no longer exist. `GET /api/runs` marks such runs `orphaned` after a 30s grace period, the panel shows "not tracked" and offers archive (`POST /api/runs/cancel` with `archive: true`), which closes the record locally and writes a `dispatch.archive` audit entry instead of pretending a cancellation worked.
- Derived run reports (`GET /dsh-workbench/api/report?runId=`): conclusion (first paragraph), key points (list items), artifacts (file paths recovered from `tool/call` arguments), open questions (interrogative sentences plus the waiting flag) and stats. Marked `derived` and always carries the raw reply for a disclosure — the panel shows the digest, never the log.
- Close-out route (`POST /api/close`): writes the next first step, an outcome colour, the basis run id and an optional decision in one call, then regenerates the injected `AGENTS.md` block. The panel treats a missing close-out as a visible gap, never as a blocker.
- The reused views live inside the moments that need them: the dispatch composer and template row inside Attach, the run report inside Close out, decisions / audit / metrics behind disclosures.
- Append-only audit trail: every panel write records time, action, request id and a compact before/after summary in `audit.jsonl`, shown in the panel via `GET /dsh-workbench/api/audit`.
- Lists the profile's real model routes in the selector via the read-only `llm` service catalog (`/dsh-workbench/api/models`), pre-selecting the current default model without calling it.
- Reads optional `_workbench/ledger.json` and merges it with `relay/ledger.csv` when available.
- Reads relay cards matching `relay/cards/T-<number>.md` as task summaries.
- Resolves optional `workbench.config.json`, `dsh-workbench.json`, or `config.json` by upward probing, with `DSH_WORKBENCH_CONFIG`/`DSH_CONFIG` overrides.
- **Per-project memory (v0.9)**: one JSON record per project root (`memory/<key>.json`), a registry at `memory/projects.json`, and an append-only `memory/<key>.decisions.md`. The legacy single slot (`state.json` / `decisions.md`) is imported once into the project whose root is the workbench itself; the originals are left untouched.
- **Generated `AGENTS.md` block**: every memory write re-renders a bounded (≤2 KiB) section between `<!-- dsh-workbench:generated:start -->` and `<!-- dsh-workbench:generated:end -->` in the project root's `AGENTS.md`. Harness already injects that file on a session's first request, so the memory reaches a model with no custom prompt code and no cache-prefix damage; anything outside the markers is hand-written and never touched. This is verified live: writing the block updates an already-running session's instructions on the next file event.
- Project activation: `POST /dsh-workbench/api/memory` with a `sessionId` (or an explicit `root`) pins the project a session works in; `GET` returns the active record plus a `gap` flag meaning "work happened after the last close".
- Host tools `wb_get` / `wb_set` / `wb_close` are per-project (`project` accepts a name, key or root; default = active project): `wb_get` returns the 5-line state, the decisions or the project list, `wb_set` updates only the fields it receives, and `wb_close` records the next step, an outcome colour (`green` requires a passing script AND an existing artifact), the basis run, and appends the decision.
- Localized English/Chinese display metadata and UI strings; theme-token-based styling.
- Read-only canvas (behind a disclosure in the Working moment) renders the module → template → run chain from the same three files the panel already loads; it makes no extra request and records no audit entry, because there is no dependency semantics yet and a drawn edge would be a claim the data cannot back.
- Editable continuity stays available from Attach (mainline / stopped at / next / guardrails via `POST /api/state-edit`, decisions via `POST /api/decision-add`), and `decisions.md` is turned into labelled cards (background / decision / cost), the audit trail into a day-grouped timeline, and metrics into figures derived from `runs.json` only.
- Template dispatches are counted separately in the metrics block when any exist (template dispatches / total), so "which recipes are reused" is answerable from data rather than memory.

## Requirements

- DeepSeek Harness `>=0.2.0-rc.2`.
- Node.js runtime provided by Harness.

## Install

Clone the public repository, then install its root directory as a local bundle through Harness Plugin Manager:

```sh
git clone https://github.com/yidiao/dsh-workbench.git
```

Select the cloned `dsh-workbench/` directory in the Plugin Manager's local bundle install flow. Do not manually edit a Harness profile's package manifest or Cordis patch. The repository root is the package directory; no build step is required.

After installation, refresh the Harness Web UI, open a conversation, and pick **Workbench** in the right sidebar (the guide card titled "Workbench").

## Data paths

The plugin searches upward from its installed package directory for a directory containing `state.json` and uses that as the workbench directory. It searches upward for either `relay/ledger.csv` or `ledger.csv` to locate relay data. Explicit environment overrides take priority:

- `DSH_WORKBENCH_DIR`: directory containing the workbench's own files (`projects.json` registry, `audit.jsonl`, `runs.json`, `modules.json`, `templates.json`, `memory/`), and the default project root.
- `DSH_MEMORY_ROOT`: overrides the default project root (normally `DSH_WORKBENCH_DIR`).
- `DSH_RELAY_DIR`: directory containing optional `ledger.csv` and `cards/`.

When no data is found, the panel remains available and presents empty states. The Host `wb_set` tool creates the workbench directory if needed. Memory writes go to `<projectRoot>/memory/<key>.json` and regenerate `<projectRoot>/AGENTS.md`; nothing writes `state.json` any more (it is read once, if present, to import the legacy slot). Dispatched runs are recorded in `runs.json` (last 50) with the goal/plan/instruction so the task tab can refill them; saved modules live in `modules.json` (last 200) and saved templates in `templates.json` (last 100). A run dispatched from a template also stores `templateId`/`templateTitle`, so renaming or deleting the template never rewrites history.

Dispatching is opt-in per workspace in `workbench.config.json`:

```json
{
  "execution": {
    "enabled": true,
    "cwd": "D:/path/to/workspace"
  }
}
```

`execution.cwd` is the Session workspace passed to `sessionController.create`; it defaults to the workbench directory itself (or its parent when the directory name starts with `_`). `DSH_WORKBENCH_EXECUTION=1` enables dispatch without a config file; an explicit `enabled: false` keeps it off.

## Panel layout

The panel is a right-sidebar tab scoped to one session. Only the moment the data calls for is rendered (or the moment the user clicked).

| Moment | Answers | Content |
| --- | --- | --- |
| Attach | Where did this project stop, and what is this session for? | Project memory card (mainline, stopped at, next, red lines, gap warning, project root, "use this project"), the task box with the channel chip (`same session` / `child session`) and its reason shown before the click, `Do it here` (queues into the bound session) or — for long work — the dispatch composer opened inline. Continuity editor and the full composer behind disclosures. |
| Working | What is happening right now? | Current session card polled from `/api/live` (running/idle, steps, tool calls, waiting flag, last text behind a disclosure), the current dispatched run rebuilt from `runs.json`, canvas behind a disclosure. |
| Close out | What was produced, and what must the next session know? | One form (next first step, outcome green/yellow/red, decision title + body), then the selected run's report: conclusion, key points, artifacts, open questions, stats, raw reply behind a disclosure. Decisions and audit behind disclosures. |

A run whose session this Harness process lost is marked `not tracked` and offers `Archive` instead of a cancel that cannot work. Nothing is dispatched before the explicit confirm, and a sync task is never sent without a bound session.

## Security and privacy

Read endpoints reject non-loopback hosts and apply `connection.requestRejection` before returning workspace data. Write endpoints (`state-edit`, `decision-add`, `dispatch`, `runs/cancel`, `modules`, `templates`) apply the same loopback + browser-trust checks, accept only POST with a bounded JSON body (64 KiB), validate field types and lengths, and record each accepted write in `audit.jsonl`. Dispatch requires an explicit `dryRun: false` request, an opt-in workspace config, and a Host `sessionController`; it creates a durable Session and sends one instruction through DSH's normal Agent loop, so the profile's tool permissions, approvals and cancellation lifecycle still apply. The model catalog only reads the Host `llm` service (`listProviders`/`listModels`) and the current default selection; it never calls a model, selects a model, or changes provider configuration. Memory is written only into the project root the caller names (or the active one); the generated `AGENTS.md` section is bounded to 2 KiB and replaced in place between its markers, so hand-written instructions above and below it are preserved byte for byte. Memory responses expose the project root because that is the whole point of per-project memory, but they never include file contents from outside it. Workspace files and relay data are not included in this repository. Do not commit private project files, credentials, or generated ledgers.

## Development checks

```sh
node --check index.js
node --check client.js
node ._host_check.mjs
node ._client_check.mjs
```

`._host_check.mjs` runs the Host bundle against a mocked `sessionController` and the real filesystem: registration, guards, memory (legacy `state.json`/`decisions.md` imported once with the originals untouched, the hand-written `AGENTS.md` section preserved across regeneration, the generated block staying under 2 KiB even with every field at its limit, idempotent re-render, per-project isolation under concurrent writes, and the loopback-only guard), dispatch lifecycle (`create → selectModel → prompt`), session targeting (an explicit `sessionId` prompts that session and never calls `create`), the module library (save / upsert by kind+title / list / remove / use counter / 400-404-405-413 guards), the derived report (conclusion, points, artifacts from `tool/call` arguments, open questions, stats, 404 for an unknown run), the template store (save / same-title upsert / list / remove, dispatch inheriting the template's module ids and bumping its use counter, a stale template id still dispatching with `templateMissing`, and the 400-404-405 guards), orphaned runs (an untracked running run is flagged after the grace period; `archive: true` closes it locally and auditing `dispatch.archive`, while a refused session cancel stays 409), run status/reply, cancellation, live progress annotation (`steps`/`toolCalls`/`waiting`), and the audit actions — including that `prompt` is called with a real `AbortSignal`, matching the Host API's `prompt(request, signal)` contract, and that a finished or cancelled run never keeps the `waiting` flag. `._client_check.mjs` mounts the panel headlessly with the framework's slot contract faked and asserts: the workbench is a right-sidebar tab type with one guide entry and a session-scoped body, and registers **no** `main` slot or `sidebar.panellist` icon (so it cannot take the chat column); the moment is derived from data (a live run → working, an unclosed gap → close out, else attach; ↺ restores auto-selection); typing asks `/api/channel` and the chip shows the rule before the click; `syncGo` posts to `/api/sync` with the **injected** session id and the task text; long work disables the sync button and opens the dispatch form; the template row fills every slot and a saved module still inserts; the close-out form carries next step + outcome colour + decision title + basis run id to `/api/close`; and a panel mounted without a session says so and disables sync. The Host half is covered by `._host_check.mjs` for the same routes with a mocked `sessionController`.

Then install the package in a test profile (or a profile you explicitly designate for testing), open a conversation, and verify the panel in the right sidebar of the connected Harness Web UI: the guide entry appears, the moment matches the project's data, and a short task queued from Attach continues in that same conversation. A successful package installation alone does not prove that a browser rendered the panel.

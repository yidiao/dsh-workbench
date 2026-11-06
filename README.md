# DSH Workbench

A small Cordis bundle for DeepSeek Harness that adds a **Workbench command center** panel to the Web UI. It is organised as four tabs, each answering one question — *is work happening now* (run), *how do I assemble the next task* (task), *what did past runs actually produce* (history), and *what is the long-lived context* (workspace). Dispatches are assembled from reusable modules and can target an existing session instead of always creating one; run records are digested into conclusion / artifacts / open questions / stats with the raw reply kept behind a disclosure. It never calls a provider directly and never bypasses DSH permissions or the session lifecycle.

## Features

- Adds a `Workbench` main panel and sidebar entry, split into four tabs: **Run**, **Task**, **History**, **Workspace**. Only the selected tab is rendered.
- Provides a command-center draft form for goal, plan, instruction, and model; preview composes the exact prompt and shows whether dispatch is available.
- Dispatches one instruction into a real DSH Session via `POST /dsh-workbench/api/dispatch` (Host `sessionController.create` → optional `selectModel` → `prompt`), with `GET /dsh-workbench/api/runs` for status/reply and `POST /dsh-workbench/api/runs/cancel` for cancellation. Dispatch is opt-in per workspace (`execution.enabled`), never silent, and audited.
- Session targeting: `POST /api/dispatch` accepts an optional `sessionId`. When present it prompts that existing session (keeping its history and approvals) instead of creating a new one; `GET /api/sessions` lists dispatchable sessions with titles read from `session/title` events.
- Reusable module library (`GET`/`POST /dsh-workbench/api/modules`, stored in `modules.json`): each goal/plan/instruction slot can be filled from a saved module, saved back as one, and modules used by a dispatch get their use counter bumped — the raw material for assembling task templates and, later, a canvas.
- Derived run reports (`GET /dsh-workbench/api/report?runId=`): conclusion (first paragraph), key points (list items), artifacts (file paths recovered from `tool/call` arguments), open questions (interrogative sentences plus the waiting flag) and stats. Marked `derived` and always carries the raw reply for a disclosure — the panel shows the digest, never the log.
- History tab renders those reports per selected run and offers "reuse this run" to refill the task slots.
- Workspace tab turns `decisions.md` into labelled cards (background / decision / cost), the audit trail into a day-grouped timeline with readable action names, and metrics into figures derived from `runs.json` only (dispatch count, success rate, average duration, average steps) — no unexplainable placeholder numbers.
- Editable continuity: mainline, checkpoint, next actions and red lines can be saved from the panel (`POST /dsh-workbench/api/state-edit`), and decisions can be appended (`POST /dsh-workbench/api/decision-add`).
- Append-only audit trail: every panel write records time, action, request id and a compact before/after summary in `audit.jsonl`, shown in the panel via `GET /dsh-workbench/api/audit`.
- Lists the profile's real model routes in the selector via the read-only `llm` service catalog (`/dsh-workbench/api/models`), pre-selecting the current default model without calling it.
- Reads `_workbench/state.json`, `_workbench/state.md`, and `_workbench/decisions.md`.
- Reads optional `_workbench/ledger.json` and merges it with `relay/ledger.csv` when available.
- Reads relay cards matching `relay/cards/T-<number>.md` as task summaries.
- Resolves optional `workbench.config.json`, `dsh-workbench.json`, or `config.json` by upward probing, with `DSH_WORKBENCH_CONFIG`/`DSH_CONFIG` overrides.
- Supports primary/secondary memory sources from config or `DSH_MEMORY_PRIMARY`/`DSH_MEMORY_SECONDARY`; sources are bounded, hashed, and constrained to the workbench root.
- Exposes loopback-only GET preview routes (`/dsh-workbench/api/preview` and `/dsh-workbench/api/preview-v1`) with Harness browser trust checks; execution is explicitly disabled in phase 1.
- Keeps the legacy Host tools `wb_get`, `wb_set`, and `wb_close`.
- Localized English/Chinese display metadata and UI strings; theme-token-based styling.

## Requirements

- DeepSeek Harness `>=0.2.0-rc.2`.
- Node.js runtime provided by Harness.

## Install

Clone the public repository, then install its root directory as a local bundle through Harness Plugin Manager:

```sh
git clone https://github.com/yidiao/dsh-workbench.git
```

Select the cloned `dsh-workbench/` directory in the Plugin Manager's local bundle install flow. Do not manually edit a Harness profile's package manifest or Cordis patch. The repository root is the package directory; no build step is required.

After installation, refresh the Harness Web UI and select **Workbench** in the sidebar.

## Data paths

The plugin searches upward from its installed package directory for a directory containing `state.json` and uses that as the workbench directory. It searches upward for either `relay/ledger.csv` or `ledger.csv` to locate relay data. Explicit environment overrides take priority:

- `DSH_WORKBENCH_DIR`: directory containing `state.json`, `state.md`, and optional `decisions.md` / `ledger.json` / `audit.jsonl` / `runs.json`.
- `DSH_RELAY_DIR`: directory containing optional `ledger.csv` and `cards/`.

When no data is found, the panel remains available and presents empty states. The Host `wb_set` tool creates the workbench directory if needed. Panel edits update `state.json` only (they do not rewrite the richer `state.md` prose) and appends to `audit.jsonl`. Dispatched runs are recorded in `runs.json` (last 50) with the goal/plan/instruction so the task tab can refill them; saved modules live in `modules.json` (last 200).

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

The panel is split into four tabs; only the selected tab exists in the DOM.

| Tab | Answers | Content |
| --- | --- | --- |
| Run | Is work happening right now? | Current run card rebuilt from `runs.json` on every mount (so switching panels never loses it): status, waiting-for-answer hint, session/model/workspace, elapsed time, step and tool-call counts, the report's conclusion, cancel, and a jump to the full report. |
| Task | How do I assemble the next dispatch? | Session target (new session → ungrouped, or an existing one), goal/plan/instruction slots, each with `+ module` (insert a saved module) and `Save as module`, `Use last run` to refill from the previous dispatch, then `Preview` → `Run now`. Nothing is sent before the explicit confirm. |
| History | What did past runs produce? | Selectable run list plus that run's report: conclusion, key points, artifacts (path + producing tool), open questions, stats, and the raw reply behind a disclosure. `Reuse this run` refills the task slots. |
| Workspace | What is the long-lived context? | Continuity (mainline / stopped at / next / guardrails) with one `Edit`, decisions as labelled cards, the audit trail as a day-grouped timeline, metrics derived from `runs.json`, and the task queue. |

## Security and privacy

Read endpoints reject non-loopback hosts and apply `connection.requestRejection` before returning workspace data. Write endpoints (`state-edit`, `decision-add`, `dispatch`, `runs/cancel`) apply the same loopback + browser-trust checks, accept only POST with a bounded JSON body (64 KiB), validate field types and lengths, and record each accepted write in `audit.jsonl`. Dispatch requires an explicit `dryRun: false` request, an opt-in workspace config, and a Host `sessionController`; it creates a durable Session and sends one instruction through DSH's normal Agent loop, so the profile's tool permissions, approvals and cancellation lifecycle still apply. The model catalog only reads the Host `llm` service (`listProviders`/`listModels`) and the current default selection; it never calls a model, selects a model, or changes provider configuration. Memory sources are capped at 256 KiB per file and 12,000 characters per source; configured paths are constrained to the workbench root, including existing symlink targets, and responses expose relative source names rather than absolute paths. Workspace files and relay data are not included in this repository. Do not commit private project files, credentials, or generated ledgers.

## Development checks

```sh
node --check index.js
node --check client.js
node ._host_check.mjs
node ._client_check.mjs
```

`._host_check.mjs` runs the Host bundle against a mocked `sessionController` and the real filesystem: registration, guards, dispatch lifecycle (`create → selectModel → prompt`), session targeting (an explicit `sessionId` prompts that session and never calls `create`), the module library (save / upsert by kind+title / list / remove / use counter / 400-404-405-413 guards), the derived report (conclusion, points, artifacts from `tool/call` arguments, open questions, stats, 404 for an unknown run), run status/reply, cancellation, live progress annotation (`steps`/`toolCalls`/`waiting`), and the audit actions — including that `prompt` is called with a real `AbortSignal`, matching the Host API's `prompt(request, signal)` contract, and that a finished or cancelled run never keeps the `waiting` flag. `._client_check.mjs` mounts the panel headlessly and asserts the four tabs really switch the rendered subtree (one body at a time), that the task tab prefills from the last run, inserts a saved module, carries the chosen session id in the preview request, and declares the inserted module id; that the history tab renders conclusion/points/artifacts/pending with the raw reply behind a disclosure; and that the workspace tab renders decision cards, a day-grouped audit timeline, metrics from `runs.json`, and the continuity editor — plus the sidebar icon.

Then install the package in a test profile (or a profile you explicitly designate for testing), inspect the live `main` and `sidebar.panellist` slots, and verify the panel in the connected Harness Web UI. A successful package installation alone does not prove that a browser rendered the panel.

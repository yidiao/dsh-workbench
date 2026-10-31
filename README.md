# DSH Workbench

A small Cordis bundle for DeepSeek Harness that adds a **Workbench command center** panel to the Web UI. It displays persistent workbench state, recent decisions, relay task cards, token-ledger rows, configurable primary/secondary memory previews, and a local command draft. Phase 1 is deliberately preview-only: it does not call a model, create a session, mutate a conversation, or write workspace state from the browser panel.

## Features

- Adds a `Workbench` main panel and sidebar entry.
- Provides a command-center draft form for goal, plan, instruction, and model; submit only builds a local preview.
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

- `DSH_WORKBENCH_DIR`: directory containing `state.json`, `state.md`, and optional `decisions.md` / `ledger.json`.
- `DSH_RELAY_DIR`: directory containing optional `ledger.csv` and `cards/`.

When no data is found, the panel remains available and presents empty states. The Host `wb_set` tool creates the workbench directory if needed.

## Security and privacy

The panel and read-only catalog APIs are GET endpoints. They reject non-loopback hosts and apply `connection.requestRejection` before returning workspace data. The model catalog only reads the Host `llm` service (`listProviders`/`listModels`) and the current default selection; it never calls a model, selects a model, or changes provider configuration. Memory sources are capped at 256 KiB per file and 12,000 characters per source; configured paths are constrained to the workbench root, including existing symlink targets, and responses expose relative source names rather than absolute paths. Workspace files and relay data are not included in this repository. Do not commit private project files, credentials, or generated ledgers.

## Development checks

```sh
node --check index.js
node --check client.js
```

Then install the package in a test profile (or a profile you explicitly designate for testing), inspect the live `main` and `sidebar.panellist` slots, and verify the panel in the connected Harness Web UI. A successful package installation alone does not prove that a browser rendered the panel.

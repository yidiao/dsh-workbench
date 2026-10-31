# DSH Workbench

A small Cordis bundle for DeepSeek Harness that adds a read-only **Workbench** panel to the Web UI. It displays persistent workbench state, recent decisions, relay task cards, and token-ledger rows. It does not call a model from the panel.

## Features

- Adds a `Workbench` main panel and sidebar entry.
- Reads `_workbench/state.json`, `_workbench/state.md`, and `_workbench/decisions.md`.
- Reads optional `_workbench/ledger.json` and merges it with `relay/ledger.csv` when available.
- Reads relay cards matching `relay/cards/T-<number>.md` as task summaries.
- Keeps the legacy Host tools `wb_get`, `wb_set`, and `wb_close`.
- Localized English/Chinese display metadata and UI strings; theme-token-based styling.
- Snapshot route is loopback-only and guarded by Harness browser trust checks.

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

The panel API is a read-only GET endpoint. It rejects non-loopback hosts and applies `connection.requestRejection` before returning workspace data. Workspace files and relay data are not included in this repository. Do not commit private project files, credentials, or generated ledgers.

## Development checks

```sh
node --check index.js
node --check client.js
```

Then install the package in a test profile (or a profile you explicitly designate for testing), inspect the live `main` and `sidebar.panellist` slots, and verify the panel in the connected Harness Web UI. A successful package installation alone does not prove that a browser rendered the panel.

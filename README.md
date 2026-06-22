# routines

Effect-native local routines daemon for running scheduled routines on a user's machine.

## What this uses

- `@effect/cluster` `Entity` + `Rpc` for the routine execution boundary.
- `@effect/cluster` `SingleRunner.layer` for a local, SQL-backed single-node cluster runtime.
- `@effect/cluster` `ClusterCron.make` for persisted cron dispatch.
- Effect `Cron`, `Duration`, fibers, layers, and scoped resources for local interval routines.
- SQLite for cluster message storage and a JSONL history file for routine results.

The important Effect Cluster model is: define typed RPCs, group them into an entity, register entity handlers as a layer, then run the layer with a cluster runner. This repo starts with a single-node runner because routines are local to one machine, while preserving the same entity/RPC shape that can grow into multiple runners later.

## Quick start

```bash
bun install
bun run dev -- init
bun run dev -- list
bun run dev -- run morning-check
bun run daemon
```

The CLI is executed through `tsx`/Node. Do not run `bun src/cli.ts`; the SQLite node driver uses `better-sqlite3`, which is a Node native module.

Defaults:

- Config: `~/.routines/routines.yaml`
- Data directory: `~/.routines`
- SQLite database: `~/.routines/routines.sqlite`
- Run history: `~/.routines/history.jsonl`

## Commands

```bash
routines init [--config path] [--data-dir path]
routines list [--config path] [--data-dir path]
routines run <id> [--config path] [--data-dir path]
routines daemon [--config path] [--data-dir path]
```

Use package scripts during development:

```bash
bun run dev -- daemon --config ./routines.yaml --data-dir ./.routines
bun run dev -- run morning-check --config ./routines.yaml --data-dir ./.routines
```

## Config

```yaml
routines:
  - id: morning-check
    name: Morning Check
    command: echo 'Review calendar, inbox, and top priorities'
    timeout: 5 minutes
    schedule:
      kind: cron
      expression: 0 9 * * 1-5

  - id: every-hour
    name: Hourly Local Check
    command: echo 'hourly check'
    timeout: 1 minute
    schedule:
      kind: interval
      every: 1 hour
```

Cron expressions are parsed by Effect `Cron.parse`. Duration strings use Effect `DurationInput` syntax such as `30 seconds`, `5 minutes`, or `1 hour`.

## Architecture

```text
CLI / daemon
    │
    ▼
Routines config ──► routineScheduleLayer
    │                    │
    │                    ├─ cron: ClusterCron.make(...)
    │                    └─ interval: scoped Effect fiber loop
    │
    ▼
RoutineEntity RPC: RunRoutine
    │
    ▼
RoutineExecutor ──► local shell command
    │
    ▼
HistoryStore ──► ~/.routines/history.jsonl

LocalClusterLive
    ├─ @effect/cluster SingleRunner.layer
    └─ @effect/sql-sqlite-node SqliteClient.layer
```

## Verification

```bash
bun run check
bun run test
bun run build
```

---
name: routines
description: >-
  Run scheduled routines on the user's machine via the local `routines` daemon (Effect Cluster backed).
  Use when the user wants to create, list, run, inspect, or start/stop local scheduled routines
  (cron or interval) — e.g. "set up a morning check routine", "run the morning-check routine now",
  "start the routines daemon", "show recent routine history". Six tools cover init, list, run,
  history, daemon start, and daemon stop.
---

# Routines

`routines` is an Effect-native local routines scheduler. Routines are defined in
`~/.routines/routines.yaml` (or a custom `--config-file` / `--data-dir`), each with an `id`, `name`,
`command`, optional `cwd`/`env`/`timeout`, and a `schedule` of kind `cron` (Effect `Cron` expression)
or `interval` (Effect `Duration` string like `1 hour`). Runs execute via a local Effect Cluster
`SingleRunner` entity and results append to `~/.routines/history.jsonl`.

## Tools

- `routines_init` — create the sample config at `~/.routines/routines.yaml` if absent (seeds a
  `morning-check` routine). Run this once first.
- `routines_list` — list configured routines (id, name, schedule). Use to discover ids before running.
- `routines_run({ id })` — run a single routine by id right now, bypassing its schedule. Returns the
  full result: `status`, `exitCode`, `stdout`, `stderr`, `durationMs`.
- `routines_history({ limit? })` — read the last N runs (default 10, max 100) from
  `~/.routines/history.jsonl`.
- `routines_daemon_start` — start the background daemon (cron + interval schedules) for the session.
  Starting again stops the previous daemon.
- `routines_daemon_stop` — stop the running daemon and its schedules.

## Typical flow

1. `routines_init` → seeds `~/.routines/routines.yaml` (only if missing).
2. The user edits the config to add their routines.
3. `routines_list` → confirm routine ids.
4. `routines_run({ id: "morning-check" })` → test it on demand.
5. `routines_daemon_start` → let schedules run in the background for the session.
6. `routines_history` → review what ran and whether routines are succeeding.

## Config shape

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

The daemon is process-local: it lives only while the pi session (or a standalone `routines daemon`
process) is running. `routines_daemon_stop` and session shutdown both tear it down cleanly.

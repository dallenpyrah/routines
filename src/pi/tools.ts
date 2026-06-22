export const routinesInitTool = {
  name: "routines_init",
  label: "Routines Init",
  description:
    "Create a sample routines config at ~/.routines/routines.yaml (or a custom --config-file / --data-dir) if one does not already exist. " +
    "The sample includes a `morning-check` routine. Run this once before `routines_list`, `routines_run`, or `routines_daemon_start`.",
  promptSnippet: "Create the sample routines config (routines_init) if ~/.routines/routines.yaml is missing",
  promptGuidelines: [
    "Run routines_init once to seed ~/.routines/routines.yaml when no routines config exists yet.",
    "After routines_init, the user can edit ~/.routines/routines.yaml to add their own routines before running or starting the daemon.",
  ],
}

export const routinesListTool = {
  name: "routines_list",
  label: "Routines List",
  description:
    "List the routines defined in the routines config (default ~/.routines/routines.yaml). " +
    "Each row shows id, name, schedule kind, and expression/interval. Use this before routines_run to confirm routine ids.",
  promptSnippet: "List configured routines (routines_list) to discover available ids",
  promptGuidelines: [
    "Run routines_list to discover available routine ids before calling routines_run.",
    "If routines_list fails because the config is missing, run routines_init first.",
  ],
}

export const routinesRunTool = {
  name: "routines_run",
  label: "Routines Run",
  description:
    "Run a single routine by id right now, bypassing its schedule. Loads the routines config, executes the routine command via the local Effect Cluster entity, " +
    "records the result to ~/.routines/history.jsonl, and returns the full run result (status, exit code, stdout, stderr, duration). " +
    "Use this to test a routine immediately or to trigger one on demand.",
  promptSnippet: "Run a routine on demand by id (routines_run) — returns stdout/stderr/status",
  promptGuidelines: [
    "Use routines_run to trigger a routine immediately for testing or ad-hoc execution; it bypasses the schedule.",
    "Pass the routine id from routines_list. The result includes stdout, stderr, status, exit code, and durationMs.",
  ],
}

export const routinesHistoryTool = {
  name: "routines_history",
  label: "Routines History",
  description:
    "Read recent routine run results from ~/.routines/history.jsonl. Returns the last N entries (default 10, max 100) as a summary with startedAt, routineId, status, and duration. " +
    "Use this to review what ran and whether routines are succeeding.",
  promptSnippet: "Read recent routine run history (routines_history) — last N results",
  promptGuidelines: [
    "Use routines_history to inspect recent runs and verify routines are succeeding on schedule.",
    "Pass limit (1-100) to control how many recent entries are returned; default is 10.",
  ],
}

export const routinesDaemonStartTool = {
  name: "routines_daemon_start",
  label: "Routines Daemon Start",
  description:
    "Start the routines daemon in the background for the current pi session. Loads the config, launches the full Effect Cluster app layer " +
    "(cron + interval schedules plus the routine entity), and keeps it alive until `routines_daemon_stop` or session shutdown. " +
    "Only one daemon runs per session; starting again stops the previous one.",
  promptSnippet: "Start the routines daemon (routines_daemon_start) to run schedules in the background",
  promptGuidelines: [
    "Use routines_daemon_start to begin running cron and interval routines in the background for the session.",
    "Starting the daemon again, or session shutdown, stops any previously running daemon.",
  ],
}

export const routinesDaemonStopTool = {
  name: "routines_daemon_stop",
  label: "Routines Daemon Stop",
  description:
    "Stop the running routines daemon, interrupting all cron and interval schedules. Safe to call when no daemon is running.",
  promptSnippet: "Stop the routines daemon (routines_daemon_stop)",
  promptGuidelines: [
    "Use routines_daemon_stop to tear down the background daemon and its schedules.",
  ],
}

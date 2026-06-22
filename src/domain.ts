import { Schema } from "effect";

export const RoutineSchedule = Schema.Union(
  Schema.Struct({
    kind: Schema.Literal("cron"),
    expression: Schema.String,
    timezone: Schema.optional(Schema.String),
  }),
  Schema.Struct({
    kind: Schema.Literal("interval"),
    every: Schema.String,
  }),
);

export type RoutineSchedule = Schema.Schema.Type<typeof RoutineSchedule>;

export const RoutineDefinition = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  command: Schema.String,
  cwd: Schema.optional(Schema.String),
  env: Schema.optional(
    Schema.Record({ key: Schema.String, value: Schema.String }),
  ),
  timeout: Schema.optional(Schema.String),
  schedule: RoutineSchedule,
});

export type RoutineDefinition = Schema.Schema.Type<typeof RoutineDefinition>;

export const RoutinesConfig = Schema.Struct({
  routines: Schema.Array(RoutineDefinition),
});

export type RoutinesConfig = Schema.Schema.Type<typeof RoutinesConfig>;

export const RunStatus = Schema.Literal("success", "failure", "timeout");

export const RoutineRunResult = Schema.Struct({
  routineId: Schema.String,
  status: RunStatus,
  exitCode: Schema.optional(Schema.Number),
  signal: Schema.optional(Schema.String),
  stdout: Schema.String,
  stderr: Schema.String,
  startedAt: Schema.String,
  finishedAt: Schema.String,
  durationMs: Schema.Number,
});

export type RoutineRunResult = Schema.Schema.Type<typeof RoutineRunResult>;

export const RoutineExecutionError = Schema.Struct({
  _tag: Schema.Literal("RoutineExecutionError"),
  routineId: Schema.String,
  message: Schema.String,
  exitCode: Schema.optional(Schema.Number),
  signal: Schema.optional(Schema.String),
  stderr: Schema.optional(Schema.String),
});

export type RoutineExecutionError = Schema.Schema.Type<
  typeof RoutineExecutionError
>;

export const sampleConfig: RoutinesConfig = {
  routines: [
    {
      id: "morning-check",
      name: "Morning Check",
      command: "echo 'Review calendar, inbox, and top priorities'",
      timeout: "5 minutes",
      schedule: {
        kind: "cron",
        expression: "0 9 * * 1-5",
      },
    },
  ],
};

import { ClusterSchema, Entity } from "@effect/cluster";
import { Rpc } from "@effect/rpc";
import { Effect } from "effect";
import {
  RoutineDefinition,
  RoutineExecutionError,
  RoutineRunResult,
  type RoutineRunResult as RoutineRunResultType,
} from "./domain.js";
import { RoutineExecutor, RoutineProcessError } from "./executor.js";
import type { RoutineDurationError } from "./duration.js";
import { HistoryStore } from "./history.js";

export const RunRoutine = Rpc.make("RunRoutine", {
  payload: {
    routine: RoutineDefinition,
  },
  success: RoutineRunResult,
  error: RoutineExecutionError,
}).annotate(ClusterSchema.Persisted, true);

export const RoutineEntity = Entity.make("Routine", [RunRoutine]);

const toExecutionError = (
  routineId: string,
  error: RoutineProcessError | RoutineDurationError,
): RoutineExecutionError => {
  if (error._tag === "RoutineDurationError") {
    return {
      _tag: "RoutineExecutionError",
      routineId,
      message: `Invalid duration for ${error.label}: ${error.input}`,
    };
  }
  return {
    _tag: "RoutineExecutionError",
    routineId,
    message: error.message,
    ...(error.exitCode === undefined ? {} : { exitCode: error.exitCode }),
    ...(error.signal === undefined ? {} : { signal: error.signal }),
    ...(error.stderr === undefined ? {} : { stderr: error.stderr }),
  };
};

const failedResult = (
  routineId: string,
  error: RoutineExecutionError,
): RoutineRunResultType => {
  const now = new Date().toISOString();
  return {
    routineId,
    status: error.message.includes("timed out") ? "timeout" : "failure",
    ...(error.exitCode === undefined ? {} : { exitCode: error.exitCode }),
    ...(error.signal === undefined ? {} : { signal: error.signal }),
    stdout: "",
    stderr: error.stderr ?? "",
    startedAt: now,
    finishedAt: now,
    durationMs: 0,
  };
};

export const RoutineEntityLive = RoutineEntity.toLayer(
  Effect.gen(function* () {
    const executor = yield* RoutineExecutor;
    const history = yield* HistoryStore;
    return RoutineEntity.of({
      RunRoutine: ({ payload }) =>
        executor.run(payload.routine).pipe(
          Effect.tap((result) =>
            history.record(result).pipe(Effect.catchAll(() => Effect.void)),
          ),
          Effect.mapError((error) =>
            toExecutionError(payload.routine.id, error),
          ),
          Effect.tapError((error) =>
            history
              .record(failedResult(payload.routine.id, error))
              .pipe(Effect.catchAll(() => Effect.void)),
          ),
        ),
    });
  }),
  {
    maxIdleTime: "10 minutes",
    concurrency: 1,
    mailboxCapacity: 64,
  },
);

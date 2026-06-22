import { ClusterCron, Sharding } from "@effect/cluster";
import { Cron, Effect, Either, Layer } from "effect";
import type { RoutineDefinition } from "./domain.js";
import { parseDuration, type RoutineDurationError } from "./duration.js";
import { RoutineEntity } from "./routine-entity.js";

export class RoutineScheduleError extends Error {
  readonly _tag = "RoutineScheduleError";
  constructor(
    readonly routineId: string,
    message: string,
    readonly cause?: unknown,
  ) {
    super(message);
  }
}

const runThroughCluster = (routine: RoutineDefinition) =>
  Effect.gen(function* () {
    const clientFor = yield* RoutineEntity.client;
    const routineClient = clientFor(routine.id);
    yield* Effect.logInfo(`running routine ${routine.id}`);
    const result = yield* routineClient.RunRoutine({ routine });
    yield* Effect.logInfo(
      `routine ${routine.id} completed with ${result.status} in ${result.durationMs}ms`,
    );
  }).pipe(
    Effect.catchAll((error) =>
      Effect.logError(`routine ${routine.id} failed: ${JSON.stringify(error)}`),
    ),
  );

const cronLayer = (routine: RoutineDefinition) => {
  if (routine.schedule.kind !== "cron") return Layer.empty;
  const parsed = Cron.parse(
    routine.schedule.expression,
    routine.schedule.timezone,
  );
  if (Either.isLeft(parsed)) {
    throw new RoutineScheduleError(
      routine.id,
      `Invalid cron expression for routine ${routine.id}: ${routine.schedule.expression}`,
      parsed.left,
    );
  }
  return ClusterCron.make({
    name: `routine:${routine.id}`,
    cron: parsed.right,
    execute: runThroughCluster(routine),
    shardGroup: "routines",
    skipIfOlderThan: "1 hour",
  });
};

const intervalLayer = (routine: RoutineDefinition) => {
  if (routine.schedule.kind !== "interval") return Layer.empty;
  const everyInput = routine.schedule.every;
  return Layer.scopedDiscard(
    Effect.gen(function* () {
      const every = yield* parseDuration(`${routine.id} interval`, everyInput);
      yield* runThroughCluster(routine).pipe(
        Effect.delay(every),
        Effect.forever,
        Effect.forkScoped,
        Effect.asVoid,
      );
    }),
  );
};

export const routineScheduleLayer = (
  routines: ReadonlyArray<RoutineDefinition>,
) => {
  let layer: Layer.Layer<never, RoutineDurationError, Sharding.Sharding> =
    Layer.empty;
  for (const routine of routines) {
    layer = Layer.merge(layer, cronLayer(routine));
    layer = Layer.merge(layer, intervalLayer(routine));
  }
  return layer;
};

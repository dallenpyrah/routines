import { TestRunner } from "@effect/cluster";
import { mkdir } from "node:fs/promises";
import { Effect, Layer } from "effect";
import type { RoutinesConfig } from "./domain.js";
import { RoutineExecutorLive } from "./executor.js";
import { HistoryStoreLive } from "./history.js";
import { LocalClusterLive } from "./local-cluster.js";
import type { RuntimePaths } from "./paths.js";
import { RoutineEntity, RoutineEntityLive } from "./routine-entity.js";
import { routineScheduleLayer } from "./task-scheduler.js";

export const ensureDataDir = (paths: RuntimePaths) =>
  Effect.tryPromise({
    try: () => mkdir(paths.dataDir, { recursive: true }),
    catch: (cause) => cause,
  });

const makeServicesLayer = (paths: RuntimePaths) =>
  Layer.mergeAll(RoutineExecutorLive, HistoryStoreLive(paths.historyFile));

const makeEntityLayer = (paths: RuntimePaths) =>
  RoutineEntityLive.pipe(Layer.provideMerge(makeServicesLayer(paths)));

const makeOneShotLayer = (paths: RuntimePaths) =>
  makeEntityLayer(paths).pipe(Layer.provideMerge(TestRunner.layer));

export const makeAppLayer = (paths: RuntimePaths, config: RoutinesConfig) =>
  Layer.mergeAll(
    makeEntityLayer(paths),
    routineScheduleLayer(config.routines),
  ).pipe(Layer.provide(LocalClusterLive(paths)));

export const runRoutineNow = (
  paths: RuntimePaths,
  config: RoutinesConfig,
  routineId: string,
) =>
  Effect.gen(function* () {
    const routine = config.routines.find(
      (candidate) => candidate.id === routineId,
    );
    if (!routine) {
      return yield* Effect.fail(new Error(`Unknown routine: ${routineId}`));
    }
    const clientFor = yield* RoutineEntity.client;
    const routineClient = clientFor(routine.id);
    return yield* routineClient.RunRoutine({ routine });
  }).pipe(Effect.provide(makeOneShotLayer(paths)));

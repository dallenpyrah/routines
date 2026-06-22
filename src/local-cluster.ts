import { RunnerAddress, SingleRunner } from "@effect/cluster";
import { SqliteClient } from "@effect/sql-sqlite-node";
import { Layer, Option } from "effect";
import type { RuntimePaths } from "./paths.js";

const localRunnerAddress = Option.some(RunnerAddress.make("127.0.0.1", 31416));

export const LocalClusterLive = (paths: RuntimePaths) =>
  SingleRunner.layer({
    runnerStorage: "memory",
    shardingConfig: {
      runnerAddress: localRunnerAddress,
      runnerListenAddress: localRunnerAddress,
      availableShardGroups: ["default", "routines"],
      assignedShardGroups: ["default", "routines"],
      shardsPerGroup: 16,
      entityMailboxCapacity: 64,
      entityMaxIdleTime: "10 minutes",
      simulateRemoteSerialization: true,
    },
  }).pipe(
    Layer.provide(
      SqliteClient.layer({
        filename: paths.databaseFile,
      }),
    ),
  );

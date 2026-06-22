import { appendFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { Context, Data, Effect, Layer } from "effect";
import type { RoutineRunResult } from "./domain.js";

export class HistoryStoreError extends Data.TaggedError("HistoryStoreError")<{
  readonly path: string;
  readonly message: string;
  readonly cause?: unknown;
}> {}

export interface HistoryStoreShape {
  readonly record: (
    result: RoutineRunResult,
  ) => Effect.Effect<void, HistoryStoreError>;
}

export class HistoryStore extends Context.Tag("HistoryStore")<
  HistoryStore,
  HistoryStoreShape
>() {}

export const HistoryStoreLive = (path: string) =>
  Layer.succeed(HistoryStore, {
    record: (result: RoutineRunResult) =>
      Effect.tryPromise({
        try: async () => {
          await mkdir(dirname(path), { recursive: true });
          await appendFile(path, `${JSON.stringify(result)}\n`, "utf8");
        },
        catch: (cause) =>
          new HistoryStoreError({
            path,
            message: `Unable to write routine history to ${path}`,
            cause,
          }),
      }),
  });

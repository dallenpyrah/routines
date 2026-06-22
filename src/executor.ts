import { spawn } from "node:child_process";
import { Context, Data, Duration, Effect, Layer } from "effect";
import type { RoutineDefinition, RoutineRunResult } from "./domain.js";
import { parseDuration, type RoutineDurationError } from "./duration.js";

export class RoutineProcessError extends Data.TaggedError(
  "RoutineProcessError",
)<{
  readonly routineId: string;
  readonly message: string;
  readonly exitCode?: number;
  readonly signal?: string;
  readonly stderr?: string;
}> {}

const outputLimit = 64 * 1024;

const trimOutput = (value: string) =>
  value.length <= outputLimit ? value : value.slice(value.length - outputLimit);

const optionalExit = (
  exitCode: number | null,
  signal: NodeJS.Signals | null,
) => ({
  ...(exitCode === null ? {} : { exitCode }),
  ...(signal === null ? {} : { signal }),
});

export interface RoutineExecutorShape {
  readonly run: (
    routine: RoutineDefinition,
  ) => Effect.Effect<
    RoutineRunResult,
    RoutineProcessError | RoutineDurationError
  >;
}

export class RoutineExecutor extends Context.Tag("RoutineExecutor")<
  RoutineExecutor,
  RoutineExecutorShape
>() {}

export const RoutineExecutorLive = Layer.succeed(RoutineExecutor, {
  run: (routine: RoutineDefinition) =>
    Effect.gen(function* () {
      const timeout = routine.timeout
        ? yield* parseDuration(`${routine.id} timeout`, routine.timeout)
        : undefined;
      const timeoutMs = timeout ? Duration.toMillis(timeout) : undefined;
      return yield* Effect.async<RoutineRunResult, RoutineProcessError>(
        (resume) => {
          const startedAtMs = Date.now();
          const startedAt = new Date(startedAtMs).toISOString();
          const child = spawn(routine.command, {
            cwd: routine.cwd,
            env: { ...process.env, ...(routine.env ?? {}) },
            shell: true,
            stdio: ["ignore", "pipe", "pipe"],
          });
          let stdout = "";
          let stderr = "";
          let timedOut = false;
          const timer = timeoutMs
            ? setTimeout(() => {
                timedOut = true;
                child.kill("SIGTERM");
              }, timeoutMs)
            : undefined;
          child.stdout?.on("data", (chunk: Buffer) => {
            stdout = trimOutput(stdout + chunk.toString("utf8"));
          });
          child.stderr?.on("data", (chunk: Buffer) => {
            stderr = trimOutput(stderr + chunk.toString("utf8"));
          });
          child.on("error", (error) => {
            if (timer) clearTimeout(timer);
            resume(
              Effect.fail(
                new RoutineProcessError({
                  routineId: routine.id,
                  message: error.message,
                  stderr,
                }),
              ),
            );
          });
          child.on("close", (exitCode, signal) => {
            if (timer) clearTimeout(timer);
            const finishedAtMs = Date.now();
            const result: RoutineRunResult = {
              routineId: routine.id,
              status: timedOut
                ? "timeout"
                : exitCode === 0
                  ? "success"
                  : "failure",
              ...optionalExit(exitCode, signal),
              stdout,
              stderr,
              startedAt,
              finishedAt: new Date(finishedAtMs).toISOString(),
              durationMs: finishedAtMs - startedAtMs,
            };
            if (result.status === "success") {
              resume(Effect.succeed(result));
            } else {
              resume(
                Effect.fail(
                  new RoutineProcessError({
                    routineId: routine.id,
                    message: timedOut
                      ? `Routine timed out after ${routine.timeout}`
                      : `Routine exited with code ${exitCode ?? "unknown"}`,
                    ...optionalExit(exitCode, signal),
                    stderr,
                  }),
                ),
              );
            }
          });
          return Effect.sync(() => {
            if (timer) clearTimeout(timer);
            if (!child.killed) child.kill("SIGTERM");
          });
        },
      );
    }),
});

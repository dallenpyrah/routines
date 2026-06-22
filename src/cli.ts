#!/usr/bin/env node
import { NodeRuntime } from "@effect/platform-node";
import { Console, Effect, Layer } from "effect";
import { inspect } from "node:util";
import { ensureDataDir, makeAppLayer, runRoutineNow } from "./app.js";
import { loadConfig, writeSampleConfig } from "./config.js";
import { makeRuntimePaths } from "./paths.js";

type Command = "daemon" | "init" | "list" | "run" | "help";

interface ParsedArgs {
  readonly command: Command;
  readonly values: ReadonlyArray<string>;
  readonly configFile: string | undefined;
  readonly dataDir: string | undefined;
}

const takeOption = (args: ReadonlyArray<string>, name: string) => {
  const index = args.indexOf(name);
  if (index === -1) return { value: undefined, rest: args };
  const value = args[index + 1];
  if (!value) throw new Error(`Missing value for ${name}`);
  return {
    value,
    rest: [...args.slice(0, index), ...args.slice(index + 2)],
  };
};

const parseArgs = (argv: ReadonlyArray<string>): ParsedArgs => {
  const config = takeOption(argv, "--config");
  const dataDir = takeOption(config.rest, "--data-dir");
  const [rawCommand, ...values] = dataDir.rest;
  const command = rawCommand ?? "help";
  if (
    !["daemon", "init", "list", "run", "help", "--help", "-h"].includes(command)
  ) {
    throw new Error(`Unknown command: ${command}`);
  }
  return {
    command:
      command === "--help" || command === "-h" ? "help" : (command as Command),
    values,
    configFile: config.value,
    dataDir: dataDir.value,
  };
};

const usage = `routines

Usage:
  routines init [--config path] [--data-dir path]
  routines list [--config path] [--data-dir path]
  routines run <id> [--config path] [--data-dir path]
  routines daemon [--config path] [--data-dir path]

Default config: ~/.routines/routines.yaml
Default data:   ~/.routines
`;

const formatError = (error: unknown) =>
  error instanceof Error
    ? `${error.name}: ${error.message}`
    : inspect(error, { depth: 8 });

const program = Effect.suspend(() => {
  const parsed = parseArgs(process.argv.slice(2));
  const paths = makeRuntimePaths({
    configFile: parsed.configFile,
    dataDir: parsed.dataDir,
  });
  switch (parsed.command) {
    case "help":
      return Console.log(usage);
    case "init":
      return writeSampleConfig(paths.configFile).pipe(
        Effect.flatMap((path) => Console.log(`Created ${path}`)),
      );
    case "list":
      return loadConfig(paths.configFile).pipe(
        Effect.flatMap((config) =>
          Console.log(
            config.routines
              .map(
                (routine) =>
                  `${routine.id}\t${routine.name}\t${routine.schedule.kind}`,
              )
              .join("\n"),
          ),
        ),
      );
    case "run": {
      const routineId = parsed.values[0];
      if (!routineId) return Effect.fail(new Error("Missing routine id"));
      return ensureDataDir(paths).pipe(
        Effect.zipRight(loadConfig(paths.configFile)),
        Effect.flatMap((config) => runRoutineNow(paths, config, routineId)),
        Effect.flatMap((result) =>
          Console.log(JSON.stringify(result, null, 2)),
        ),
      );
    }
    case "daemon":
      return ensureDataDir(paths).pipe(
        Effect.zipRight(loadConfig(paths.configFile)),
        Effect.flatMap((config) =>
          Console.log(
            `Starting routines daemon with ${config.routines.length} routine(s)`,
          ).pipe(Effect.zipRight(Layer.launch(makeAppLayer(paths, config)))),
        ),
      );
  }
});

NodeRuntime.runMain(
  program.pipe(
    Effect.catchAll((error) =>
      Console.error(formatError(error)).pipe(
        Effect.zipRight(Effect.fail(error)),
      ),
    ),
  ),
);

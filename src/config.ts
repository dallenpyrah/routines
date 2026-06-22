import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { Effect, Schema } from "effect";
import YAML from "yaml";
import { RoutinesConfig, sampleConfig } from "./domain.js";

export class ConfigFileError extends Error {
  readonly _tag = "ConfigFileError";
  constructor(
    readonly path: string,
    message: string,
    readonly cause?: unknown,
  ) {
    super(message);
  }
}

const decodeConfig = Schema.decodeUnknown(RoutinesConfig);

export const loadConfig = (path: string) =>
  Effect.tryPromise({
    try: async () => {
      const text = await readFile(path, "utf8");
      const raw = path.endsWith(".json") ? JSON.parse(text) : YAML.parse(text);
      return raw;
    },
    catch: (cause) =>
      new ConfigFileError(path, `Unable to read ${path}`, cause),
  }).pipe(
    Effect.flatMap((raw) => decodeConfig(raw)),
    Effect.mapError((cause) =>
      cause instanceof ConfigFileError
        ? cause
        : new ConfigFileError(
            path,
            `Invalid routines config at ${path}`,
            cause,
          ),
    ),
  );

export const writeSampleConfig = (path: string) =>
  Effect.tryPromise({
    try: async () => {
      await mkdir(dirname(path), { recursive: true });
      await writeFile(path, YAML.stringify(sampleConfig), { flag: "wx" });
      return path;
    },
    catch: (cause) =>
      new ConfigFileError(path, `Unable to create ${path}`, cause),
  });

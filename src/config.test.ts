import { mkdtemp } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import { Duration, Effect } from "effect";
import { loadConfig, writeSampleConfig } from "./config.js";
import { parseDuration } from "./duration.js";

describe("config", () => {
  it("writes and reads the sample routines file", async () => {
    const dir = await mkdtemp(join(tmpdir(), "routines-test-"));
    const path = join(dir, "routines.yaml");
    await Effect.runPromise(writeSampleConfig(path));
    const config = await Effect.runPromise(loadConfig(path));
    expect(config.routines.map((routine) => routine.id)).toEqual([
      "morning-check",
    ]);
  });

  it("accepts Effect duration strings", async () => {
    const duration = await Effect.runPromise(
      parseDuration("test", "5 minutes"),
    );
    expect(Duration.toMillis(duration)).toBe(300000);
  });
});

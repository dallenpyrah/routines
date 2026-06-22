import type { ExtensionAPI } from "@earendil-works/pi-coding-agent"
import { Effect, Fiber, Layer } from "effect"
import { Type } from "typebox"
import { existsSync } from "node:fs"
import { readFile } from "node:fs/promises"
import { makeAppLayer, runRoutineNow } from "../app.js"
import { loadConfig, writeSampleConfig } from "../config.js"
import { makeRuntimePaths } from "../paths.js"
import {
  routinesDaemonStartTool,
  routinesDaemonStopTool,
  routinesHistoryTool,
  routinesInitTool,
  routinesListTool,
  routinesRunTool,
} from "./tools.js"

interface ToolResult {
  readonly content: Array<{ type: "text"; text: string }>
  readonly details: Record<string, unknown>
}

const textResult = (text: string, details: Record<string, unknown>): ToolResult => ({
  content: [{ type: "text", text }],
  details,
})

const messageOf = (error: unknown): string =>
  error instanceof Error ? error.message : String(error)

const initParameters = Type.Object({
  configFile: Type.Optional(
    Type.String({ description: "Override config file path (default ~/.routines/routines.yaml)" }),
  ),
  dataDir: Type.Optional(
    Type.String({ description: "Override data directory (default ~/.routines)" }),
  ),
})

const listParameters = Type.Object({
  configFile: Type.Optional(Type.String({ description: "Override config file path" })),
  dataDir: Type.Optional(Type.String({ description: "Override data directory" })),
})

const runParameters = Type.Object({
  id: Type.String({ description: "Routine id to run" }),
  configFile: Type.Optional(Type.String({ description: "Override config file path" })),
  dataDir: Type.Optional(Type.String({ description: "Override data directory" })),
})

const historyParameters = Type.Object({
  limit: Type.Optional(
    Type.Number({ minimum: 1, maximum: 100, description: "Number of recent runs to return (default 10)" }),
  ),
  dataDir: Type.Optional(Type.String({ description: "Override data directory" })),
})

const daemonStartParameters = Type.Object({
  configFile: Type.Optional(Type.String({ description: "Override config file path" })),
  dataDir: Type.Optional(Type.String({ description: "Override data directory" })),
})

const daemonStopParameters = Type.Object({})

interface InitParams {
  readonly configFile?: string
  readonly dataDir?: string
}
interface ListParams {
  readonly configFile?: string
  readonly dataDir?: string
}
interface RunParams {
  readonly id: string
  readonly configFile?: string
  readonly dataDir?: string
}
interface HistoryParams {
  readonly limit?: number
  readonly dataDir?: string
}
interface DaemonStartParams {
  readonly configFile?: string
  readonly dataDir?: string
}

export default function routinesExtension(pi: ExtensionAPI) {
  let daemonFiber: Fiber.Fiber<unknown, unknown> | undefined

  const stopDaemon = async () => {
    const fiber = daemonFiber
    daemonFiber = undefined
    if (fiber) {
      await Effect.runPromise(Fiber.interrupt(fiber)).catch(() => {})
    }
  }

  const runInit = async (params: InitParams): Promise<ToolResult> => {
    const paths = makeRuntimePaths({ configFile: params.configFile, dataDir: params.dataDir })
    try {
      const created = await Effect.runPromise(writeSampleConfig(paths.configFile))
      return textResult(`Created sample routines config at ${created}`, { configFile: created })
    } catch (error) {
      return textResult(`routines init failed: ${messageOf(error)}`, {
        error: messageOf(error),
        configFile: paths.configFile,
      })
    }
  }

  const runList = async (params: ListParams): Promise<ToolResult> => {
    const paths = makeRuntimePaths({ configFile: params.configFile, dataDir: params.dataDir })
    try {
      const config = await Effect.runPromise(loadConfig(paths.configFile))
      const rows = config.routines.map((routine) => {
        const schedule =
          routine.schedule.kind === "cron"
            ? `cron ${routine.schedule.expression}`
            : `interval ${routine.schedule.every}`
        return `${routine.id}\t${routine.name}\t${schedule}`
      })
      const text = rows.length > 0 ? rows.join("\n") : "No routines configured."
      return textResult(text, { count: config.routines.length, configFile: paths.configFile })
    } catch (error) {
      return textResult(`routines list failed: ${messageOf(error)}`, {
        error: messageOf(error),
        configFile: paths.configFile,
      })
    }
  }

  const runRun = async (
    params: RunParams,
    signal: AbortSignal | undefined,
  ): Promise<ToolResult> => {
    const paths = makeRuntimePaths({ configFile: params.configFile, dataDir: params.dataDir })
    try {
      const config = await Effect.runPromise(loadConfig(paths.configFile))
      const result = await Effect.runPromise(
        runRoutineNow(paths, config, params.id),
        signal ? { signal } : undefined,
      )
      return textResult(JSON.stringify(result, null, 2), {
        routineId: result.routineId,
        status: result.status,
        durationMs: result.durationMs,
        exitCode: result.exitCode ?? null,
        configFile: paths.configFile,
      })
    } catch (error) {
      return textResult(`routines run failed: ${messageOf(error)}`, {
        routineId: params.id,
        error: messageOf(error),
        configFile: paths.configFile,
      })
    }
  }

  const runHistory = async (params: HistoryParams): Promise<ToolResult> => {
    const paths = makeRuntimePaths({ dataDir: params.dataDir })
    const limit = typeof params.limit === "number" ? params.limit : 10
    try {
      if (!existsSync(paths.historyFile)) {
        return textResult("No routine history yet.", { historyFile: paths.historyFile, count: 0 })
      }
      const text = await readFile(paths.historyFile, "utf8")
      const lines = text.split("\n").filter((line) => line.trim().length > 0)
      const recent = lines.slice(-limit)
      const entries = recent
        .map((line) => {
          try {
            return JSON.parse(line) as Record<string, unknown>
          } catch {
            return null
          }
        })
        .filter((value): value is Record<string, unknown> => value !== null)
      const summary = entries
        .map(
          (entry) =>
            `${String(entry.startedAt ?? "?")}\t${String(entry.routineId ?? "?")}\t${String(entry.status ?? "?")}\t${String(entry.durationMs ?? "?")}ms`,
        )
        .join("\n")
      return textResult(summary, { historyFile: paths.historyFile, count: entries.length })
    } catch (error) {
      return textResult(`routines history failed: ${messageOf(error)}`, {
        error: messageOf(error),
        historyFile: paths.historyFile,
      })
    }
  }

  const runDaemonStart = async (params: DaemonStartParams): Promise<ToolResult> => {
    await stopDaemon()
    const paths = makeRuntimePaths({ configFile: params.configFile, dataDir: params.dataDir })
    try {
      const config = await Effect.runPromise(loadConfig(paths.configFile))
      const fiber = Effect.runFork(Layer.launch(makeAppLayer(paths, config)))
      daemonFiber = fiber
      return textResult(`Routines daemon started with ${config.routines.length} routine(s).`, {
        configFile: paths.configFile,
        dataDir: paths.dataDir,
        routines: config.routines.length,
      })
    } catch (error) {
      return textResult(`routines daemon start failed: ${messageOf(error)}`, {
        error: messageOf(error),
        configFile: paths.configFile,
      })
    }
  }

  const runDaemonStop = async (): Promise<ToolResult> => {
    if (!daemonFiber) {
      return textResult("Routines daemon is not running.", { running: false })
    }
    await stopDaemon()
    return textResult("Routines daemon stopped.", { running: false })
  }

  pi.on("session_shutdown", async () => {
    await stopDaemon()
  })

  pi.registerTool({
    ...routinesInitTool,
    parameters: initParameters,
    execute: (_toolCallId: string, params: InitParams) => runInit(params),
  })
  pi.registerTool({
    ...routinesListTool,
    parameters: listParameters,
    execute: (_toolCallId: string, params: ListParams) => runList(params),
  })
  pi.registerTool({
    ...routinesRunTool,
    parameters: runParameters,
    execute: (_toolCallId: string, params: RunParams, signal?: AbortSignal) =>
      runRun(params, signal),
  })
  pi.registerTool({
    ...routinesHistoryTool,
    parameters: historyParameters,
    execute: (_toolCallId: string, params: HistoryParams) => runHistory(params),
  })
  pi.registerTool({
    ...routinesDaemonStartTool,
    parameters: daemonStartParameters,
    execute: (_toolCallId: string, params: DaemonStartParams) => runDaemonStart(params),
  })
  pi.registerTool({
    ...routinesDaemonStopTool,
    parameters: daemonStopParameters,
    execute: () => runDaemonStop(),
  })
}

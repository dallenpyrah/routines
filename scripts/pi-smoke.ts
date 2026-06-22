import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import routinesExtension from "../src/pi/extension.ts"

interface Handler {
  (event: unknown, ctx: unknown): Promise<unknown> | unknown
}

interface RegisteredTool {
  name: string
  label: string
  description: string
  promptSnippet?: string
  promptGuidelines?: ReadonlyArray<string>
  execute: (
    id: string,
    params: unknown,
    signal?: AbortSignal,
  ) => Promise<{ content: Array<{ text: string }>; details: Record<string, unknown> }>
}

const handlers = new Map<string, Handler>()
const tools = new Map<string, RegisteredTool>()

const pi = {
  on: (event: string, handler: Handler) => handlers.set(event, handler),
  registerTool: (tool: RegisteredTool) => tools.set(tool.name, tool),
  registerCommand: () => {},
  sendMessage: () => {},
  sendUserMessage: () => {},
}

const textOf = (result: { content: Array<{ text: string }> }) =>
  result.content[0]?.text ?? ""

const main = async () => {
  const dataDir = mkdtempSync(join(tmpdir(), "routines-pi-smoke-"))
  try {
    routinesExtension(pi as never)
    const names = [...tools.keys()].sort()
    console.log("registered tools:", names.join(", "))
    const expected = [
      "routines_daemon_start",
      "routines_daemon_stop",
      "routines_history",
      "routines_init",
      "routines_list",
      "routines_run",
    ]
    if (names.join(",") !== expected.join(",")) {
      throw new Error(`expected tools ${expected.join(",")}, got ${names.join(",")}`)
    }

    const init = tools.get("routines_init")!
    const list = tools.get("routines_list")!
    const run = tools.get("routines_run")!
    const history = tools.get("routines_history")!
    const daemonStart = tools.get("routines_daemon_start")!
    const daemonStop = tools.get("routines_daemon_stop")!

    const initResult = await init.execute("c1", { dataDir })
    console.log("init:", textOf(initResult))
    if (!textOf(initResult).includes("Created sample routines config")) {
      throw new Error("init did not create config")
    }

    const listResult = await list.execute("c2", { dataDir })
    console.log("list:", textOf(listResult))
    if (!textOf(listResult).includes("morning-check")) {
      throw new Error("list did not include morning-check")
    }

    const runResult = await run.execute("c3", { id: "morning-check", dataDir })
    console.log("run details:", JSON.stringify(runResult.details))
    if (runResult.details.status !== "success") {
      throw new Error(`expected run status success, got ${runResult.details.status}`)
    }

    const historyResult = await history.execute("c4", { dataDir })
    console.log("history:", textOf(historyResult))
    if (historyResult.details.count !== 1) {
      throw new Error(`expected 1 history entry, got ${historyResult.details.count}`)
    }

    const startResult = await daemonStart.execute("c5", { dataDir })
    console.log("daemon start:", textOf(startResult))
    if (!textOf(startResult).includes("daemon started")) {
      throw new Error("daemon did not start")
    }

    const stopResult = await daemonStop.execute("c6", {})
    console.log("daemon stop:", textOf(stopResult))
    if (!textOf(stopResult).includes("stopped")) {
      throw new Error("daemon did not stop")
    }

    const shutdown = handlers.get("session_shutdown")
    if (shutdown) await shutdown({ reason: "quit" }, {})
    console.log("session_shutdown done")

    console.log("\nSMOKE OK")
  } finally {
    rmSync(dataDir, { recursive: true, force: true })
  }
}

await main()

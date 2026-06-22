import { homedir } from "node:os";
import { join, resolve } from "node:path";

export interface RuntimePaths {
  readonly configFile: string;
  readonly dataDir: string;
  readonly databaseFile: string;
  readonly historyFile: string;
}

export const defaultDataDir = () => join(homedir(), ".routines");

export const defaultConfigFile = () => join(defaultDataDir(), "routines.yaml");

export const makeRuntimePaths = (options: {
  readonly configFile?: string | undefined;
  readonly dataDir?: string | undefined;
}): RuntimePaths => {
  const dataDir = resolve(options.dataDir ?? defaultDataDir());
  const configFile = resolve(
    options.configFile ?? join(dataDir, "routines.yaml"),
  );
  return {
    dataDir,
    configFile,
    databaseFile: join(dataDir, "routines.sqlite"),
    historyFile: join(dataDir, "history.jsonl"),
  };
};

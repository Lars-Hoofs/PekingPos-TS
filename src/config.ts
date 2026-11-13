import type { DatabaseSettings } from "./dal/index.js";

export interface Config {
  port: number;
  database: DatabaseSettings;
}

/** Reads the settings from environment variables. DB/setup.sh writes them to .env. */
export function readConfig(env: NodeJS.ProcessEnv): Config {
  const missing = ["DB_SERVER", "DB_NAME", "DB_USER", "DB_PASSWORD"].filter((name) => !env[name]);
  if (missing.length > 0) {
    throw new Error(`Missing environment variables: ${missing.join(", ")}. Run DB/setup.sh first.`);
  }
  return {
    port: portNumber(env["PORT"] ?? "3000", "PORT"),
    database: {
      server: env["DB_SERVER"] ?? "",
      port: portNumber(env["DB_PORT"] ?? "1433", "DB_PORT"),
      database: env["DB_NAME"] ?? "",
      user: env["DB_USER"] ?? "",
      password: env["DB_PASSWORD"] ?? "",
    },
  };
}

function portNumber(value: string, name: string): number {
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error(`${name} must be a port number between 1 and 65535, got "${value}".`);
  }
  return port;
}

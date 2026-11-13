import sql from "mssql";

export interface DatabaseSettings {
  server: string;
  port: number;
  database: string;
  user: string;
  password: string;
}

export interface Parameter {
  name: string;
  type: sql.ISqlType | (() => sql.ISqlType);
  value: unknown;
}

/** Time limits: a slow database shows an error page within seconds instead of a frozen till. */
const connectTimeoutMs = 3_000;
const requestTimeoutMs = 5_000;

/**
 * One connection pool for the application. The pool connects on first use and connects again
 * after a failure, so the application starts and recovers while the database is down.
 */
export class Database {
  readonly #config: sql.config;
  #pool: Promise<sql.ConnectionPool> | null = null;

  constructor(settings: DatabaseSettings) {
    this.#config = {
      server: settings.server,
      port: settings.port,
      database: settings.database,
      user: settings.user,
      password: settings.password,
      connectionTimeout: connectTimeoutMs,
      requestTimeout: requestTimeoutMs,
      options: { encrypt: true, trustServerCertificate: true },
    };
  }

  async request(parameters: readonly Parameter[] = [], transaction?: sql.Transaction): Promise<sql.Request> {
    const request = transaction === undefined ? (await this.#connectedPool()).request() : transaction.request();
    for (const parameter of parameters) {
      request.input(parameter.name, parameter.type, parameter.value);
    }
    return request;
  }

  /** Runs the work in one transaction: everything is stored, or nothing. */
  async inTransaction<T>(work: (transaction: sql.Transaction) => Promise<T>): Promise<T> {
    const transaction = (await this.#connectedPool()).transaction();
    await transaction.begin();
    let result: T;
    try {
      result = await work(transaction);
    } catch (error) {
      await rollbackAfterError(transaction);
      throw error;
    }
    await transaction.commit();
    return result;
  }

  async close(): Promise<void> {
    if (this.#pool !== null) {
      const pool = await this.#pool.catch(() => null);
      this.#pool = null;
      await pool?.close();
    }
  }

  #connectedPool(): Promise<sql.ConnectionPool> {
    if (this.#pool === null) {
      const pool = new sql.ConnectionPool(this.#config);
      pool.on("error", () => {
        this.#pool = null;
      });
      this.#pool = pool.connect().catch((error: unknown) => {
        this.#pool = null;
        throw error;
      });
    }
    return this.#pool;
  }
}

async function rollbackAfterError(transaction: sql.Transaction): Promise<void> {
  try {
    await transaction.rollback();
  } catch {
    // SQL Server already rolled back after the error. The original error is the one to report.
  }
}

/** True for the errors SQL Server gives when a row breaks a unique index or constraint. */
export function isUniqueViolation(error: unknown): boolean {
  return error instanceof sql.RequestError && (error.number === 2601 || error.number === 2627);
}

/** True for every error that comes from the database or the connection to it. */
export function isDatabaseError(error: unknown): boolean {
  return error instanceof sql.MSSQLError;
}

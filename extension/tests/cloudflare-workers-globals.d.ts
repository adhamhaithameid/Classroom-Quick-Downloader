// Minimal Cloudflare worker globals for cross-package integration tests.
// This keeps extension's tsc compile happy when importing worker source files.
declare interface DurableObjectNamespace {}

declare interface DurableObjectState {
  storage: {
    get<T>(key: string): Promise<T | undefined>;
    put(key: string, value: unknown): Promise<void>;
    delete(key: string): Promise<void>;
    getAlarm(): Promise<number | null>;
    setAlarm(ts: number): Promise<void>;
    deleteAlarm(): Promise<void>;
  };
  waitUntil(promise: Promise<unknown>): void;
  blockConcurrencyWhile?<T>(callback: () => Promise<T>): Promise<T>;
}

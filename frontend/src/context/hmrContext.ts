import { createContext, type Context } from "react";

/** Reuse the same React context across Vite HMR so providers and hooks stay in sync. */
export function createHmrContext<T>(key: string): Context<T | undefined> {
  const store = globalThis as Record<string, Context<T | undefined> | undefined>;
  if (!store[key]) {
    store[key] = createContext<T | undefined>(undefined);
  }
  return store[key]!;
}

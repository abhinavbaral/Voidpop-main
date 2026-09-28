// DEMO MODE stand-in for shared/backend/storage.js: starts with a sample
// library and keeps changes in memory only, so a presentation always starts
// from the same state. The REAL store.js runs on top of it.
import { seedDemoDb } from "./seed.js";

const memory = new Map([["voidation:db:v1", JSON.stringify(seedDemoDb())]]);

export function setStorage() {
  /* ignored in demo mode: the platform's real storage is never touched */
}

export const readKey = async (key) => memory.get(key) ?? null;
export const writeKey = async (key, value) => void memory.set(key, value);

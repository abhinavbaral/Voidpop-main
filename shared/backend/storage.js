// Where Voidation keeps your data: on this device, nowhere else.
//
// Each platform plugs in its own key-value store at startup:
//   web/src/init.js          → localStorage
//   app/src/backend/init.js  → AsyncStorage
// Demo mode swaps this whole file for shared/demo/storage.js (sample library).
//
// An adapter is { getItem(key), setItem(key, value), removeItem?(key) } returning values or promises.

const memory = new Map();
let adapter = {
  getItem: (k) => memory.get(k) ?? null,
  setItem: (k, v) => void memory.set(k, v),
  removeItem: (k) => void memory.delete(k),
};

export function setStorage(next) {
  adapter = next;
}

export const readKey = async (key) => adapter.getItem(key);
export const writeKey = async (key, value) => adapter.setItem(key, value);
export const removeKey = async (key) => (adapter.removeItem ? adapter.removeItem(key) : adapter.setItem(key, ""));

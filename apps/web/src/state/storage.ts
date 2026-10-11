import { createJSONStorage, type StateStorage } from 'zustand/middleware';

// localStorage can throw (private mode, blocked site data, managed school devices).
// Fall back to memory so the game always runs; progress just won't survive a reload.
const memory = new Map<string, string>();

const safeStorage: StateStorage = {
  getItem: (k) => {
    try {
      return localStorage.getItem(k);
    } catch {
      return memory.get(k) ?? null;
    }
  },
  setItem: (k, v) => {
    try {
      localStorage.setItem(k, v);
    } catch {
      memory.set(k, v);
    }
  },
  removeItem: (k) => {
    try {
      localStorage.removeItem(k);
    } catch {
      memory.delete(k);
    }
  },
};

export const deviceStorage = createJSONStorage(() => safeStorage);

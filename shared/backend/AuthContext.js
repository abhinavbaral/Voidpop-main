// Voidation has no accounts: whoever holds the device is "you".
// This keeps the same useAuth() shape the screens were written against, so a
// real sign-in can be added later without touching every screen.
import { createContext, createElement, useContext } from "react";

export const LOCAL_USER = Object.freeze({ uid: "local", username: "you", name: "You" });

const value = { user: LOCAL_USER, ready: true };
const Ctx = createContext(value);

// createElement instead of JSX: shared code stays plain JS for every bundler
export function AuthProvider({ children }) {
  return createElement(Ctx.Provider, { value }, children);
}

export const useAuth = () => useContext(Ctx);

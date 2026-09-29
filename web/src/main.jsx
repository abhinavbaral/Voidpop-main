import "./init.js"; // must run first: plugs in localStorage
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, MemoryRouter } from "react-router-dom";
import { AuthProvider } from "@voidation/shared/backend/AuthContext";
import { SettingsProvider } from "@voidation/shared/backend/SettingsContext";
import { ThemeProvider } from "./theme.jsx";
import App from "./App.jsx";
import ErrorBoundary from "./components/ErrorBoundary.jsx";
import "./styles.css";

// Real URLs everywhere, except the single-file preview build (VITE_ROUTER=memory),
// which is embedded in a page that has no paths of its own.
const Router = import.meta.env.VITE_ROUTER === "memory" ? MemoryRouter : BrowserRouter;

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <ThemeProvider>
      <AuthProvider>
        <SettingsProvider>
          <Router>
            <ErrorBoundary>
              <App />
            </ErrorBoundary>
          </Router>
        </SettingsProvider>
      </AuthProvider>
    </ThemeProvider>
  </StrictMode>
);

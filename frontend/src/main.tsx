import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles.css";

// Some Stellar SDK transitive deps expect a Node-style global.
if (typeof (globalThis as { global?: unknown }).global === "undefined") {
  (globalThis as { global?: unknown }).global = globalThis;
}

const container = document.getElementById("root");
if (!container) throw new Error("Root element #root not found");

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

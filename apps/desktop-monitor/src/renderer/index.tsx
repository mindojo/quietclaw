import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { App } from "./app/App";
import { AppProviders } from "./app/providers";
import "./styles/globals.css";

const container = document.getElementById("root");

if (!container) {
  throw new Error("Root container not found.");
}

createRoot(container).render(
  <StrictMode>
    <AppProviders>
      <App />
    </AppProviders>
  </StrictMode>,
);

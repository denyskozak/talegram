import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import App from "./app/App";
import "./index.css";
import "@telegram-apps/telegram-ui/dist/styles.css";
import "./shared/config/i18n";

const container = document.getElementById("root");

if (!container) {
  throw new Error("Root element not found");
}

const root = createRoot(container);

root.render(
  // <StrictMode>
    <App />
  // </StrictMode>,
);

import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { preloadBrandAssets } from "./lib/preloadAssets";

if (!window.location.hash) {
  window.location.hash = "#/";
}

// Warm the brand mark into cache before first paint so the Replaiy logo never
// pops in late on the inbox / campaigns empty states.
preloadBrandAssets();

createRoot(document.getElementById("root")!).render(<App />);

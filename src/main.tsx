import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import "leaflet/dist/leaflet.css";
import { initStatusBar, isNative } from "./lib/native";

// Native enhancements (no-op on plain web)
if (isNative()) {
  initStatusBar();
  // Add a class to <html> so CSS can target native vs web
  document.documentElement.classList.add('is-native');
}

createRoot(document.getElementById("root")!).render(<App />);

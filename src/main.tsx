import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

const rootElement = document.getElementById("root");
if (!rootElement) throw new Error("Torrentwide could not find its application root element.");
createRoot(rootElement).render(<App />);

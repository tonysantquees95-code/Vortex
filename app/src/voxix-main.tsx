import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./voxix/App";
import { ProvedorDoVoxix } from "./voxix/estado";
import "./voxix/index.css";
import { iniciarVisual } from "./voxix/personalizar";
import { registrarServiceWorker } from "./voxix/avisos";

iniciarVisual();
registrarServiceWorker();

createRoot(document.getElementById("raiz")!).render(<StrictMode><ProvedorDoVoxix><App /></ProvedorDoVoxix></StrictMode>);

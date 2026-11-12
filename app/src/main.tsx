import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { ProvedorDoMotor } from "./estado";
import "./index.css";

createRoot(document.getElementById("raiz")!).render(<StrictMode><ProvedorDoMotor><App /></ProvedorDoMotor></StrictMode>);

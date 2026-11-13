import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { ProvedorDoMotor } from "./estado";
import { Portao } from "./telas/Portao";
import "./index.css";
import { aplicarTema, lerTema } from "./tema";

aplicarTema(lerTema());

createRoot(document.getElementById("raiz")!).render(<StrictMode><ProvedorDoMotor><Portao><App /></Portao></ProvedorDoMotor></StrictMode>);

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { criarMotor, type Motor } from "./ponte";

const Ctx = createContext<Motor | null>(null);

export function ProvedorDoMotor({ children }: { children: ReactNode }) {
  const [motor, setMotor] = useState<Motor | null>(null);
  useEffect(() => { criarMotor().then(setMotor); }, []);
  if (!motor) return <div className="fundo-tela" />;
  return <Ctx.Provider value={motor}>{children}</Ctx.Provider>;
}

export function useMotor(): Motor {
  const m = useContext(Ctx);
  if (!m) throw new Error("Motor indisponível");
  return m;
}

import type { ReactNode } from "react";

/**
 * O Vortex é grátis (decisão de 2026-11-25: é a porta de entrada da Vetorial Tech): abre e joga sem login e sem
 * pagamento. O Vetorial ID continua existindo, mas só para quem quer os saves na nuvem e a ponte com a Vênus
 * (Ajustes › Conta). `trava.ts` fica no projeto, mas nada mais bloqueia a abertura do aplicativo.
 */
export function Portao({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

import type { Motor, RelatorioLimpeza } from "./ponte";
import { limparSozinho } from "./config";

/** Faxina automática depois de achar jogos. Devolve o relatório só se mexeu em alguma coisa; erro (ex.: sem permissão) vira null. */
export async function faxinaAutomatica(motor: Motor): Promise<RelatorioLimpeza | null> {
  if (!limparSozinho()) return null;
  try {
    const r = await motor.limpar();
    return r.duplicados.length || r.corrompidos.length ? r : null;
  } catch { return null; }
}

export const resumoDaFaxina = (r: RelatorioLimpeza) =>
  [r.duplicados.length ? `${r.duplicados.length} repetido${r.duplicados.length > 1 ? "s" : ""} na pasta Duplicados` : "", r.corrompidos.length ? `${r.corrompidos.length} quebrado${r.corrompidos.length > 1 ? "s" : ""} na pasta Corrompidos` : ""].filter(Boolean).join(" · ");

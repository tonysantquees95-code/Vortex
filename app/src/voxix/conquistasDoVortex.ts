// Leva as conquistas do Vortex para o perfil do Voxix. Fica quieto sem sessão ou sem perfil no Voxix.
import { SERVIDOR } from "./api.ts";
import { sessaoGuardada } from "./conta.ts";

let ultimo = "";

export function enviarConquistasAoVoxix(itens: { id: string; nome: string }[]): void {
  const sessao = sessaoGuardada();
  if (!sessao) return;
  const corpo = JSON.stringify({ itens: itens.slice(0, 40) });
  if (corpo === ultimo) return; // só manda quando mudou
  ultimo = corpo;
  void fetch(`${SERVIDOR}/voxix/conquistas`, { method: "PUT", headers: { "Content-Type": "application/json", Authorization: `Bearer ${sessao.token}` }, body: corpo }).catch(() => { ultimo = ""; });
}

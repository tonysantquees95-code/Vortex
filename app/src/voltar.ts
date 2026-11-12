// Botão "voltar" do aparelho (Android): em vez de sair do app, volta uma tela.
// Cada tela que tem algo para desfazer (janela aberta, subpasta, outra aba) registra uma função com uma prioridade:
// a de maior prioridade responde primeiro. Se ninguém responde, o app pede um segundo toque para sair.
type Tratador = { prioridade: number; ordem: number; f: () => boolean | void };
const pilha: Tratador[] = [];
let contador = 0;
let instalado = false;

/** Registra um tratador. Devolva false para "não era comigo". Retorna a função que desfaz o registro. */
export function registrarVoltar(prioridade: number, f: () => boolean | void): () => void {
  const t: Tratador = { prioridade, ordem: contador++, f };
  pilha.push(t);
  return () => { const i = pilha.indexOf(t); if (i >= 0) pilha.splice(i, 1); };
}

/** Roda os tratadores (maior prioridade, e o mais recente, primeiro). true = alguém tratou. */
export function tratarVoltar(): boolean {
  const ordenados = [...pilha].sort((a, b) => b.prioridade - a.prioridade || b.ordem - a.ordem);
  for (const t of ordenados) if (t.f() !== false) return true;
  return false;
}

/**
 * Liga o botão voltar: guarda uma entrada extra no histórico do WebView; a parte nativa (MainActivity) faz o
 * "voltar" andar nesse histórico. Sem tratador, avisa e deixa o próximo toque sair do app.
 */
export function instalarVoltar(avisarSair: () => void) {
  if (instalado || typeof window === "undefined") return;
  instalado = true;
  const armar = () => { try { window.history.pushState({ voltar: 1 }, ""); } catch { /* sem histórico: o app só sai */ } };
  armar();
  window.addEventListener("popstate", () => {
    if (tratarVoltar()) { armar(); return; }
    avisarSair();
    window.setTimeout(armar, 2500);
  });
}

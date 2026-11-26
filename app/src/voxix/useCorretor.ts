import { useEffect, useState } from "react";
import { criarDicionario, type Dicionario } from "./corretor";

// O dicionário (~70 mil palavras) é um pedaço separado do app: só é baixado do pacote e montado
// depois que a tela de conversa abre, para não atrasar a abertura nem a digitação.
let dicionario: Dicionario | null = null;
let carregando: Promise<void> | null = null;

export function carregarDicionario(): Promise<void> {
  carregando ??= import("./ptbr-palavras.txt?raw")
    .then((m) => { dicionario = criarDicionario(m.default.split(/\r?\n/).map((p) => p.trim()).filter(Boolean)); })
    .catch(() => { carregando = null; }); // sem dicionário o corretor só fica desligado
  return carregando;
}

/** O dicionário pronto, ou null enquanto carrega (ou se o corretor está desligado). */
export function useCorretor(ligado: boolean): Dicionario | null {
  const [d, setD] = useState<Dicionario | null>(dicionario);
  useEffect(() => {
    if (!ligado || d) return;
    let vivo = true;
    const id = window.setTimeout(() => { void carregarDicionario().then(() => { if (vivo && dicionario) setD(dicionario); }); }, 300);
    return () => { vivo = false; window.clearTimeout(id); };
  }, [ligado, d]);
  return ligado ? d : null;
}

// Palavras que a pessoa mandou manter (apelidos, gírias): o corretor não mexe mais nelas.
const CHAVE = "voxix.corretor.palavras";
const MAX_PALAVRAS = 1000;
const pessoais = new Set<string>();
let lidas = false;
function ler() {
  if (lidas) return;
  lidas = true;
  try {
    const v: unknown = JSON.parse(localStorage.getItem(CHAVE) ?? "[]");
    if (Array.isArray(v)) for (const p of v) if (typeof p === "string" && p.length <= 40) pessoais.add(p);
  } catch { /* sem lista guardada */ }
}
export function palavrasDaPessoa(): ReadonlySet<string> { ler(); return pessoais; }
export function aprender(palavra: string): void {
  ler();
  const p = palavra.toLowerCase();
  if (!p || p.length > 40) return;
  pessoais.delete(p);
  pessoais.add(p); // a mais recente fica no fim
  while (pessoais.size > MAX_PALAVRAS) pessoais.delete(pessoais.values().next().value as string);
  try { localStorage.setItem(CHAVE, JSON.stringify([...pessoais])); } catch { /* sem espaço: vale só até fechar o app */ }
}

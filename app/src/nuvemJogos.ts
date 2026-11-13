// Jogos que têm save na conta mas não estão neste aparelho (lógica pura, sem tela).
export interface SaveRemoto { jogo: string; arquivo: string; bytes: number; atualizado: number; dispositivo: string }
export interface JogoLocalMin { plataforma: string; caminho: string }
export interface JogoDaConta { chave: string; titulo: string; plataforma: string; atualizado: number; dispositivo: string }

/** Mesma regra do motor (Rust e Java): console + nome do arquivo, só letras e números separados por "-". */
export function chaveDoJogo(plataforma: string, nomeDoArquivo: string): string {
  let s = "";
  for (const c of nomeDoArquivo.toLowerCase()) {
    const x = /[a-z0-9]/.test(c) ? c : "-";
    if (x === "-" && (s === "" || s.endsWith("-"))) continue;
    s += x;
  }
  s = s.replace(/-+$/, "");
  return `${plataforma}-${s}`.slice(0, 60).replace(/-+$/, "");
}

export function chaveDoCaminho(plataforma: string, caminho: string): string {
  const nome = caminho.split(/[\\/]/).pop() ?? "";
  const p = nome.lastIndexOf(".");
  return chaveDoJogo(plataforma, p > 0 ? nome.slice(0, p) : nome);
}

const bonito = (resto: string) => resto.split("-").filter(Boolean).map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");

/** Jogos da conta que faltam aqui, do mais recente para o mais antigo (um por jogo, mesmo com save e estado). */
export function jogosQueFaltam(saves: SaveRemoto[], locais: JogoLocalMin[], plataformas: string[]): JogoDaConta[] {
  const tenho = new Set(locais.map((j) => chaveDoCaminho(j.plataforma, j.caminho)));
  const porJogo = new Map<string, JogoDaConta>();
  const ids = [...plataformas].sort((a, b) => b.length - a.length);
  for (const s of saves) {
    if (tenho.has(s.jogo)) continue;
    const plat = ids.find((id) => s.jogo.startsWith(`${id}-`)) ?? "";
    const atual = porJogo.get(s.jogo);
    if (!atual || s.atualizado > atual.atualizado) {
      porJogo.set(s.jogo, { chave: s.jogo, titulo: bonito(plat ? s.jogo.slice(plat.length + 1) : s.jogo), plataforma: plat, atualizado: s.atualizado, dispositivo: s.dispositivo });
    }
  }
  return [...porJogo.values()].sort((a, b) => b.atualizado - a.atualizado);
}

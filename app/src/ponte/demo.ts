import type { Filtro, Jogo, ModoJogoConfig, Motor } from "./tipos";

const base = (id: string, titulo: string, plataforma: string, extra: Partial<Jogo> = {}): Jogo => ({
  id, titulo, plataforma, caminho: `C:\\Jogos\\${titulo}`, bytes: 40_000_000, regioes: ["USA"], idiomas: [], tags: [],
  capa: null, capa_online: null, descricao: null, desenvolvedor: null, editora: null, ano: null, genero: null, jogadores: null,
  adicionado: 1, favorito: false, ultimo_jogo: 0, tempo_total_s: 0, sessoes: 0, disponivel: true, ...extra,
});

const DEMO: Jogo[] = [
  base("1", "Super Mario World", "snes", { ano: 1990, genero: "Plataforma", jogadores: "1-2", desenvolvedor: "Nintendo", descricao: "O clássico de Mario no Reino dos Dinossauros.", ultimo_jogo: 90, tempo_total_s: 7300, sessoes: 6, favorito: true }),
  base("2", "Sonic the Hedgehog 2", "megadrive", { ano: 1992, genero: "Plataforma", jogadores: "1-2", desenvolvedor: "Sega", ultimo_jogo: 80, tempo_total_s: 4100, sessoes: 3 }),
  base("3", "Final Fantasy VII", "psx", { ano: 1997, genero: "RPG", jogadores: "1", desenvolvedor: "Square", descricao: "Cloud e o Avalanche contra a Shinra.", ultimo_jogo: 70, tempo_total_s: 52000, sessoes: 20, favorito: true }),
  base("4", "Metroid Fusion", "gba", { ano: 2002, genero: "Ação", desenvolvedor: "Nintendo", ultimo_jogo: 60, tempo_total_s: 9000, sessoes: 4 }),
  base("5", "Pokémon Emerald", "gba", { ano: 2004, genero: "RPG", desenvolvedor: "Game Freak", tempo_total_s: 12000, sessoes: 5, favorito: true }),
  base("6", "Street Fighter II", "arcade", { ano: 1991, genero: "Luta", jogadores: "1-2", desenvolvedor: "Capcom" }),
  base("7", "The Legend of Zelda", "nes", { ano: 1986, genero: "Aventura", desenvolvedor: "Nintendo" }),
  base("8", "Castlevania: Symphony of the Night", "psx", { ano: 1997, genero: "Ação", desenvolvedor: "Konami" }),
  base("9", "Chrono Trigger", "snes", { ano: 1995, genero: "RPG", desenvolvedor: "Square" }),
  base("10", "Mega Man X", "snes", { ano: 1993, genero: "Ação", desenvolvedor: "Capcom" }),
];

const NOMES: Record<string, string> = { snes: "Super Nintendo", megadrive: "Mega Drive", psx: "PlayStation", gba: "Game Boy Advance", arcade: "Arcade", nes: "Nintendo 8 bits" };

/** Navegador comum (sem o motor): mostra uma biblioteca de exemplo para ver e testar a interface. */
export async function motorDemo(): Promise<Motor> {
  let jogos = DEMO.map((j) => ({ ...j }));
  let pastas = ["C:\\Jogos"];
  let modo: ModoJogoConfig = { ligado: true, prioridade_do_jogo: true, rebaixar_apps: true, pausar_atualizadores: true, liberar_ram: true, bloquear_notificacoes: true, energia_maxima: true, gpu_dedicada: true, manter_acordado: true, protegidos_extra: [], rebaixar_extra: [] };
  const filtrar = (f: Filtro) => {
    let l = jogos.filter((j) => (!f.plataforma || j.plataforma === f.plataforma) && (!f.so_favoritos || j.favorito) && (!f.texto || j.titulo.toLowerCase().includes(f.texto.toLowerCase())));
    const o = f.ordem ?? "titulo";
    l = [...l].sort((a, b) => o === "recentes" ? b.ultimo_jogo - a.ultimo_jogo : o === "mais_jogados" ? b.tempo_total_s - a.tempo_total_s : o === "ano" ? (b.ano ?? 0) - (a.ano ?? 0) : a.titulo.localeCompare(b.titulo));
    return f.limite ? l.slice(0, f.limite) : l;
  };
  return {
    plataforma: "demo",
    pastas: async () => pastas,
    escolherPasta: async () => "C:\\Jogos\\Novos",
    adicionarPasta: async (p) => { pastas = [...pastas, p]; return pastas; },
    removerPasta: async (p) => { pastas = pastas.filter((x) => x !== p); },
    escanear: async () => ({ encontrados: jogos.length, novos: 0, atualizados: 0, removidos: 0, ignorados: 0, pastas_ausentes: [] }),
    listar: async (f = {}) => filtrar(f),
    continuar: async (n = 12) => filtrar({ ordem: "recentes" }).filter((j) => j.ultimo_jogo > 0).slice(0, n),
    plataformas: async () => Object.keys(NOMES).map((id) => ({ id, nome: NOMES[id], tipo: "console", total: jogos.filter((j) => j.plataforma === id).length })).filter((p) => p.total > 0),
    estatisticas: async () => ({ jogos: jogos.length, plataformas: new Set(jogos.map((j) => j.plataforma)).size, favoritos: jogos.filter((j) => j.favorito).length, tempo_total_s: jogos.reduce((s, j) => s + j.tempo_total_s, 0), sessoes: jogos.reduce((s, j) => s + j.sessoes, 0) }),
    favoritar: async (id, fav) => { jogos = jogos.map((j) => (j.id === id ? { ...j, favorito: fav } : j)); },
    emuladores: async () => ({ instalados: [{ id: "retroarch", nome: "RetroArch", plataformas: Object.keys(NOMES) }] }),
    lancar: async (id) => {
      jogos = jogos.map((j) => (j.id === id ? { ...j, ultimo_jogo: Date.now() / 1000, sessoes: j.sessoes + 1 } : j));
      return { pid: 0, emulador: "RetroArch (demonstração)", nucleo: null, modo_jogo: modo.ligado };
    },
    modoJogo: async (nova) => { if (nova) modo = nova; return modo; },
    recuperarModoJogo: async () => {},
  };
}

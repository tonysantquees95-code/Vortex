// Controle virtual de cada console (a tela de botões do jogo no Android). O que cada console usa já vem definido ("automático");
// a pessoa só escolhe, se quiser, outro modelo para aquele console. O desenho em si mora em android/src/DisposicaoControles.java.
export type Escolha = "auto" | "direcional" | "analogico" | "ambos";
export const ESCOLHAS: { id: Escolha; nome: string; dica: string }[] = [
  { id: "auto", nome: "Automático", dica: "O que o console original usava." },
  { id: "direcional", nome: "Só direcional", dica: "Cruz de direção grande, sem analógico." },
  { id: "analogico", nome: "Só analógico", dica: "Alavanca na tela, sem a cruz." },
  { id: "ambos", nome: "Direcional e analógico", dica: "Alavanca grande e cruz pequena para menus." },
];

/** Consoles que rodam no motor do próprio Vortex, com o que o automático usa em cada um. */
export const CONSOLES_VIRTUAIS: { id: string; nome: string; auto: string }[] = [
  { id: "nes", nome: "Nintendo 8 bits (NES)", auto: "Direcional e 2 botões" },
  { id: "snes", nome: "Super Nintendo", auto: "Direcional, 4 botões e L/R" },
  { id: "n64", nome: "Nintendo 64", auto: "Analógico, botões C, L/R e Z" },
  { id: "gb", nome: "Game Boy", auto: "Direcional e 2 botões" },
  { id: "gbc", nome: "Game Boy Color", auto: "Direcional e 2 botões" },
  { id: "gba", nome: "Game Boy Advance", auto: "Direcional, 2 botões e L/R" },
  { id: "nds", nome: "Nintendo DS", auto: "Direcional, 4 botões e L/R" },
  { id: "3ds", nome: "Nintendo 3DS", auto: "Analógico, direcional e L/R/ZL/ZR" },
  { id: "gamecube", nome: "GameCube", auto: "Analógico, C-stick e gatilhos" },
  { id: "wii", nome: "Wii", auto: "Analógico, C-stick e gatilhos" },
  { id: "ps1", nome: "PlayStation", auto: "Direcional, 2 analógicos e L1/R1/L2/R2" },
  { id: "ps2", nome: "PlayStation 2", auto: "Direcional, 2 analógicos e L1/R1/L2/R2" },
  { id: "psp", nome: "PlayStation Portable (PSP)", auto: "Analógico, direcional e L/R" },
  { id: "genesis", nome: "Mega Drive / Genesis", auto: "Direcional e botões de 6" },
  { id: "mastersystem", nome: "Master System", auto: "Direcional e 2 botões" },
  { id: "gamegear", nome: "Game Gear", auto: "Direcional e 2 botões" },
  { id: "segacd", nome: "Mega CD", auto: "Direcional e botões de 6" },
  { id: "saturn", nome: "Sega Saturn", auto: "Direcional, 4 botões e L/R" },
  { id: "dreamcast", nome: "Dreamcast", auto: "Analógico e gatilhos" },
  { id: "atari2600", nome: "Atari 2600", auto: "Direcional e 2 botões" },
  { id: "pcengine", nome: "PC Engine", auto: "Direcional e 2 botões" },
  { id: "neogeo", nome: "Neo Geo", auto: "Direcional e 4 botões" },
  { id: "arcade", nome: "Arcade", auto: "Direcional e 4 botões" },
];

const ids = new Set<string>(ESCOLHAS.map((e) => e.id));
/** Guarda só ids de console no formato certo e escolhas conhecidas ("auto" não precisa ser guardada). */
export function limparDisposicoes(bruto: unknown): Record<string, Escolha> {
  const saida: Record<string, Escolha> = {};
  if (!bruto || typeof bruto !== "object" || Array.isArray(bruto)) return saida;
  for (const [k, v] of Object.entries(bruto as Record<string, unknown>)) {
    if (/^[a-z0-9]{2,20}$/.test(k) && typeof v === "string" && ids.has(v) && v !== "auto") saida[k] = v as Escolha;
  }
  return saida;
}

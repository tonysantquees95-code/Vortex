// "O que há de novo": a tela que aparece depois de uma atualização.
// REGRA: toda mudança que altere o que o app faz ou como se usa (função nova, melhoria de fluxo, correção) ganha uma linha AQUI,
// com id = o maior id + 1. A tela mostra só o que a pessoa ainda não viu, então não depende do número da versão.
export type TipoNovidade = "novo" | "melhoria" | "correcao";
export interface Novidade { id: number; data: string; tipo: TipoNovidade; titulo: string; texto: string }

export const NOVIDADES: Novidade[] = [
  { id: 1, data: "2026-11-14", tipo: "novo", titulo: "Apresentação e novidades", texto: "Na primeira abertura o Vortex mostra o que ele faz e como usar, antes dos termos. Depois de cada atualização, esta tela conta o que mudou." },
  { id: 2, data: "2026-11-14", tipo: "novo", titulo: "Aba Controles reformulada", texto: "A aba Controles agora fica por último e funciona no Android e no Windows: mostra o controle conectado, deixa buscar o driver quando ele não é reconhecido e guarda perfis. Em Configurar botões você aperta cada botão e o Vortex aprende onde ele está, mesmo num controle genérico." },
  { id: 3, data: "2026-11-14", tipo: "melhoria", titulo: "Arquivos foi para os Ajustes", texto: "O atalho Arquivos saiu da barra de baixo para ninguém abrir outro aplicativo sem querer. Agora ele fica em Ajustes › Jogos. Também trocamos o ícone de Ajustes por uma engrenagem." },
  { id: 4, data: "2026-11-14", tipo: "novo", titulo: "Perfil de botões nos jogos", texto: "No Windows, cada perfil da aba Controles tem o botão Usar nos jogos: o Vortex grava os botões que você ensinou no RetroArch, e o controle passa a funcionar do seu jeito dentro dos jogos. Feche e abra o jogo depois." },
  { id: 5, data: "2026-11-14", tipo: "novo", titulo: "Controle certo para cada console", texto: "Agora o Vortex sabe o que cada console usa e abre o jogo já com o controle certo na tela: analógico no PSP, PlayStation, Nintendo 64, GameCube, Wii, 3DS e Dreamcast; só direcional e 2 botões no NES e no Game Boy; L e R onde o console tem. Em Ajustes › Aparência › Botões na tela do jogo você pode trocar o modelo de qualquer console (só direcional, só analógico ou os dois)." },
  { id: 6, data: "2026-11-15", tipo: "novo", titulo: "Teclado no Windows", texto: "No computador, sem controle ligado, o rodapé mostra as teclas: setas para navegar, Enter para abrir, A e D para trocar de aba, R para atualizar a biblioteca, U para ver se há versão nova, F para favoritar e Esc para voltar." },
  { id: 7, data: "2026-11-15", tipo: "novo", titulo: "Luz do logo com a cor que você quiser", texto: "Em Ajustes você escolhe a luz que corre em volta das letras do Vortex: a padrão, RGB (muda de cor), branca ou uma cor de sua escolha." },
  { id: 8, data: "2026-11-15", tipo: "correcao", titulo: "Jogo em destaque sem corte e luz do logo sempre correndo", texto: "Quando um jogo fica maior ao ser selecionado, o brilho e as bordas não são mais cortados nas pontas da lista. A luz em volta do nome Vortex agora corre mesmo se o Windows estiver com os efeitos de animação desligados. Jogos em .zip com imagem de PSP (.iso/.cso) agora são reconhecidos ao organizar a biblioteca." },
];

export const ROTULO: Record<TipoNovidade, string> = { novo: "Novo", melhoria: "Melhorou", correcao: "Corrigido" };
export const ultimoId = (lista: Novidade[] = NOVIDADES): number => lista.reduce((m, n) => Math.max(m, n.id), 0);
/** O que a pessoa ainda não viu, da mais nova para a mais antiga. */
export const novasDesde = (visto: number, lista: Novidade[] = NOVIDADES): Novidade[] => lista.filter((n) => n.id > visto).sort((a, b) => b.id - a.id);

const CHAVE = "vortex.novidades.vistas";
/** null = nunca guardou (primeira instalação: a apresentação já explica tudo, então não mostra o histórico). */
export function lerVisto(): number | null {
  try { const v = localStorage.getItem(CHAVE); if (v === null) return null; const n = Number(v); return Number.isInteger(n) && n >= 0 ? n : null; } catch { return null; }
}
export function marcarVisto(id: number = ultimoId()): void {
  try { localStorage.setItem(CHAVE, String(id)); } catch { /* sem armazenamento: mostra de novo na próxima vez */ }
}

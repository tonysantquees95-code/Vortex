// Apresentação da primeira abertura (antes dos termos). Função nova: acrescente ou ajuste um passo em TOUR.
const CHAVE_TOUR = "vortex.tour";
export interface PassoDoTour { icone: string; titulo: string; texto: string; como?: string[] }

export const TOUR: PassoDoTour[] = [
  { icone: "🎮", titulo: "Bem-vindo ao Vortex", texto: "Sua central de jogos retrô: encontra os jogos que você já tem, organiza por console e abre cada um com o emulador embutido.", como: ["Use o controle ou o toque: A confirma, B volta.", "Você pode rever esta apresentação em Ajustes › Sobre."] },
  { icone: "📚", titulo: "Biblioteca e Início", texto: "O Vortex procura os jogos na pasta que você escolher e monta as coleções por console, com capas.", como: ["Atualize a biblioteca com o botão X do controle ou em Ajustes.", "Favorite com Y e continue de onde parou pelo Início."] },
  { icone: "🛒", titulo: "Loja e Controles", texto: "Baixe jogos livres pela Loja do Vortex e configure o controle na aba Controles (a última da barra): ela mostra o controle conectado, busca o driver e deixa ensinar cada botão.", como: ["Os downloads são conferidos antes de abrir.", "No Android, o serviço opcional Vortex Controle permite usar o controle nos jogos."] },
  { icone: "☁️", titulo: "Saves e conta", texto: "Entrando com o Vetorial ID, os saves dos seus jogos vão para a nuvem e você continua em outro aparelho.", como: ["Sem conta, tudo continua funcionando só neste aparelho."] },
  { icone: "🔄", titulo: "Sempre atualizado", texto: "Ligue Atualizar sozinho em Ajustes › Atualizações e o Vortex avisa o que mudou a cada versão.", como: ["Aperte Start no controle para conferir se há versão nova."] },
];

export const tourVisto = (): boolean => { try { return localStorage.getItem(CHAVE_TOUR) === "1"; } catch { return false; } };
export const marcarTourVisto = (): void => { try { localStorage.setItem(CHAVE_TOUR, "1"); } catch { /* ok */ } };

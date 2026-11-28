// Apresentação da primeira abertura (antes dos termos). Função nova: acrescente ou ajuste um passo em TOUR.
const CHAVE_TOUR = "vortex.tour";
export interface PassoDoTour { icone: string; titulo: string; texto: string; como?: string[] }

export const TOUR: PassoDoTour[] = [
  { icone: "controles", titulo: "Bem-vindo ao Vortex", texto: "Sua central de jogos retrô: encontra os jogos que você já tem, organiza por console e abre cada um com o emulador embutido.", como: ["Use o controle ou o toque: A confirma, B volta. No computador: setas, Enter e Esc, e A e D trocam de aba.", "Você pode rever esta apresentação em Ajustes › Sobre."] },
  { icone: "biblioteca", titulo: "Biblioteca e Início", texto: "O Vortex procura os jogos na pasta que você escolher e monta as coleções por console, com capas.", como: ["Atualize a biblioteca com o botão X do controle ou em Ajustes.", "Favorite com Y e continue de onde parou pelo Início."] },
  { icone: "loja", titulo: "Loja e Controles", texto: "Baixe jogos livres pela Loja do Vortex e configure o controle na aba Controles (a última da barra): ela mostra o controle conectado, busca o driver e deixa ensinar cada botão.", como: ["Os downloads são conferidos antes de abrir.", "No Android, o serviço opcional Vortex Controle permite usar o controle nos jogos."] },
  { icone: "aparencia", titulo: "Seu jogo, seu jeito", texto: "Escolha um tema pronto em Ajustes › Visual, acompanhe as Conquistas e, dentro do jogo, salve o estado, volte no tempo, tire fotos da tela e troque o filtro de imagem.", como: ["No Android, abra a Game Bar por cima do jogo. No Windows, use F2 para salvar, F4 para carregar e F8 para a foto."] },
  { icone: "chat", titulo: "Voxix: o chat do Vortex", texto: "O Voxix vive dentro do Vortex: converse com quem joga, entre em comunidades e salas de voz, mostre seus jogos mais jogados e conquistas e veja quem está jogando agora.", como: ["Abra pelo botão Voxix da barra. Ele abre em outra janela (Windows) ou outra tela (Android), e o Vortex continua rodando.", "Em Voxix › Privacidade você escolhe quem vê o que você está jogando: amigos, todos ou ninguém."] },
  { icone: "nuvem", titulo: "Saves e conta", texto: "Entrando com o Vetorial ID, os saves dos seus jogos vão para a nuvem e você continua em outro aparelho.", como: ["Depois de entrar, o Vortex abre mesmo sem internet."] },
  { icone: "atualizar", titulo: "Sempre atualizado", texto: "Ligue Atualizar sozinho em Ajustes › Atualizações e o Vortex avisa o que mudou a cada versão.", como: ["Aperte Start no controle para conferir se há versão nova."] },
];

export const tourVisto = (): boolean => { try { return localStorage.getItem(CHAVE_TOUR) === "1"; } catch { return false; } };
export const marcarTourVisto = (): void => { try { localStorage.setItem(CHAVE_TOUR, "1"); } catch { /* ok */ } };

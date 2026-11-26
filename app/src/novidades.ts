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
  { id: 9, data: "2026-11-15", tipo: "melhoria", titulo: "Atualização com barra de download", texto: "Ao achar uma versão nova do Vortex, o aviso mostra a barra do download e, quando termina, você escolhe a hora de tocar em Instalar agora. É o mesmo jeito da Vênus, no Android e no Windows." },
  { id: 10, data: "2026-11-15", tipo: "novo", titulo: "Descompacta 7z e RAR, e ZIP com nome trocado", texto: "Ao achar jogos soltos, o Vortex agora também descompacta arquivos 7z e RAR, e ZIP que na verdade são RAR ou 7z com o nome trocado. O jogo vai para a pasta do console certo e aparece na biblioteca, como já acontecia com ZIP. Esses arquivos deixam de ir para a pasta Corrompidos por engano." },
  { id: 11, data: "2026-11-17", tipo: "correcao", titulo: "Apresentação rola no celular deitado", texto: "Com o celular deitado, a janela da apresentação ficava cortada e não dava para chegar nos botões. Agora o texto rola e os botões Voltar, Próximo e Pular ficam sempre à vista." },
  { id: 12, data: "2026-11-17", tipo: "melhoria", titulo: "Motor do console mais seguro", texto: "Antes de usar o motor de um console baixado, o Vortex confere se o arquivo é mesmo um motor do tipo certo para o seu aparelho. Se vier uma página de erro, um arquivo cortado ou um motor de outro processador, ele recusa e pede para tentar de novo, em vez de travar o jogo." },
  { id: 13, data: "2026-11-18", tipo: "correcao", titulo: "Cabe na tela do celular em pé", texto: "No celular em pé, a barra de cima (hora, bateria, controle e internet) não passa mais da largura da tela e o app deixa de sair para o lado." },
  { id: 14, data: "2026-11-21", tipo: "novo", titulo: "Feedback e relato de erros", texto: "Em Ajustes › Sobre você encontra Enviar feedback e Reportar um erro: conte o que achou, avise quando algo não funcionou e responda uma pesquisa rápida de 1 minuto. O Vortex está em fase de testes (beta) e cada relato ajuda a melhorar." },
  { id: 15, data: "2026-11-25", tipo: "novo", titulo: "Temas prontos", texto: "Em Ajustes › Visual há 9 temas prontos: Arcade neon, Console de sala, Cinema, Minimalista, Preto total, TV de tubo, Portátil, Vidro e Retrô 80. Um toque muda cor, fundo, formato e tamanho das cartas, e dá para ajustar o resto depois. Também chegaram três fundos novos: TV de tubo, Vidro e Preto total." },
  { id: 16, data: "2026-11-25", tipo: "novo", titulo: "Conquistas", texto: "Em Ajustes › Conquistas você vê marcos do seu jeito de jogar: horas jogadas, partidas, tamanho da coleção, consoles diferentes e favoritos. O Vortex avisa quando você cumpre uma. Tudo é calculado no seu aparelho e nada vai para a internet." },
  { id: 17, data: "2026-11-25", tipo: "melhoria", titulo: "Continuar de onde parou em destaque", texto: "O jogo que você jogou por último agora aparece num cartão com a capa e o tempo jogado, logo na tela inicial. Um toque e você volta ao jogo." },
  { id: 18, data: "2026-11-25", tipo: "novo", titulo: "Estados salvos, voltar no tempo e foto da tela (Android)", texto: "Na Game Bar, por cima do jogo, você salva e carrega o jogo em 3 espaços, volta 3 ou 6 segundos para desfazer um erro (nos consoles leves, como NES, Super Nintendo, Game Boy e Mega Drive) e tira uma foto da tela. As fotos ficam em Imagens › Vortex." },
  { id: 19, data: "2026-11-25", tipo: "novo", titulo: "Filtros de imagem (Android)", texto: "Ainda na Game Bar, escolha o filtro da imagem: Padrão, Nítido, Suave, TV de tubo ou LCD. O Vortex lembra a sua escolha." },
  { id: 20, data: "2026-11-25", tipo: "novo", titulo: "Dentro do jogo (Windows)", texto: "Em Ajustes › Emuladores, escolha o filtro de imagem de todos os jogos e ligue o retroceder. No jogo: F2 salva, F4 carrega, segure R para voltar no tempo, segure Espaço para acelerar e F8 tira uma foto da tela. Com controle, aperte Start e Select juntos para abrir o menu do RetroArch." },
  { id: 21, data: "2026-11-25", tipo: "novo", titulo: "Vortex grátis, sem login", texto: "O Vortex agora é 100% grátis: abra e jogue sem criar conta e sem pagar nada. O Vetorial ID ficou opcional, só para quem quer os saves na nuvem. Os termos foram atualizados para dizer isso." },
  { id: 22, data: "2026-11-26", tipo: "correcao", titulo: "Aviso do Vetorial ID mais claro", texto: "A tela de configuração do primeiro acesso agora diz que o Vortex abre sem conta; o Vetorial ID é só para guardar saves na nuvem e ligar com a Vênus." },
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

/** Termos de uso do Vortex. Mudou o texto: suba a VERSAO e a pessoa aceita de novo. */
export const VERSAO_DOS_TERMOS = 4;
const CHAVE = "vortex.termos";

export const TERMOS: { titulo: string; texto: string }[] = [
  { titulo: "1. O que é o Vortex", texto: "O Vortex é uma central de jogos retrô da Vetorial Tech. Ele encontra os jogos que você já tem, organiza por console, abre cada um com o emulador embutido e oferece uma loja de jogos gratuitos e liberados pelos próprios autores." },
  { titulo: "2. Seus jogos e a lei", texto: "O Vortex não fornece jogos protegidos por direitos autorais nem links para baixá-los. Use apenas jogos que você tem o direito de usar: os da loja do Vortex, jogos livres, e cópias de jogos que você comprou, quando a lei do seu país permitir. Você é o único responsável pelos arquivos que coloca no Vortex e por como os obteve." },
  { titulo: "3. Licença e gratuidade", texto: "O Vortex é um aplicativo licenciado, não vendido, e é grátis: você usa para jogar sem pagamento. Para usar, é preciso entrar com o Vetorial ID (conta grátis): a Vetorial Tech precisa saber quem baixa e usa os seus produtos. O Vetorial ID também liga os saves na nuvem e a ponte com a Vênus. A licença é pessoal e não pode ser revendida. O dono do projeto pode, no futuro, incluir recursos extras pagos, sempre avisando antes e sem tirar a possibilidade de jogar de graça." },
  { titulo: "4. Aparelhos", texto: "Cada conta pode ter até 3 aparelhos vinculados e usar até 2 ao mesmo tempo. Para vincular um quarto aparelho, remova um dos anteriores." },
  { titulo: "5. Saves na nuvem", texto: "Se você entrar com o Vetorial ID, os saves dos seus jogos são enviados para a nuvem da Vetorial Tech e ficam ligados à sua conta, para você continuar de onde parou em outro aparelho. Cada conta tem 256 MB. Quando o save mudou em dois aparelhos, o Vortex pergunta qual manter e guarda uma cópia do que for trocado. Você pode sair da conta quando quiser; os saves continuam no seu aparelho." },
  { titulo: "6. Controle e outros apps", texto: "No Android, o serviço opcional “Vortex Controle” usa a acessibilidade apenas para tocar na tela quando você aperta um botão do controle, em jogos que você escolheu. Ele não lê o conteúdo da tela. Para a ponte com a Vênus (“Vênus, abra o jogo X”), o Vortex precisa estar aberto e com a sua conta." },
  { titulo: "7. Voxix, o chat do Vortex", texto: "O Vortex traz o Voxix, o chat para quem joga. Se você criar um perfil no Voxix, o Vortex avisa o servidor da Vetorial Tech qual jogo você está jogando (só o nome do jogo e o aparelho), e isso aparece como “jogando agora” no seu perfil apenas para quem você permitir: amigos (padrão), todos ou ninguém (invisível), em Voxix › Privacidade. Também guardamos o tempo jogado por jogo, para mostrar os seus três mais jogados, e as suas conquistas. Sem perfil no Voxix, nada disso é enviado." },
  { titulo: "8. Downloads e internet", texto: "Na primeira vez de cada console o Vortex baixa o motor de emulação, de fontes oficiais, e na loja baixa os jogos conferindo a integridade do arquivo. Isso usa a sua internet. Os motores de emulação são software livre de terceiros e seguem as licenças deles." },
  { titulo: "9. Garantias", texto: "O Vortex é oferecido como está. O desempenho depende do seu aparelho, e alguns consoles pesados podem rodar mal em aparelhos fracos. A Vetorial Tech não se responsabiliza por perda de saves, por jogos de terceiros nem por uso em desacordo com a lei." },
  { titulo: "10. Mudanças", texto: "Estes termos podem mudar. Quando mudarem, o Vortex pede que você aceite de novo antes de continuar." },
];

export function termosAceitos(): boolean {
  try { return localStorage.getItem(CHAVE) === String(VERSAO_DOS_TERMOS); } catch { return false; }
}
export function aceitarTermos() {
  try { localStorage.setItem(CHAVE, String(VERSAO_DOS_TERMOS)); } catch { /* sem armazenamento: pede de novo na próxima vez */ }
}

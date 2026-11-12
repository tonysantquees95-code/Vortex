/** Termos de uso do Vortex. Mudou o texto: suba a VERSAO e a pessoa aceita de novo. */
export const VERSAO_DOS_TERMOS = 1;
const CHAVE = "vortex.termos";

export const TERMOS: { titulo: string; texto: string }[] = [
  { titulo: "1. O que é o Vortex", texto: "O Vortex é uma central de jogos retrô da Vetorial Tech. Ele encontra os jogos que você já tem, organiza por console, abre cada um com o emulador embutido e oferece uma loja de jogos gratuitos e liberados pelos próprios autores." },
  { titulo: "2. Seus jogos e a lei", texto: "O Vortex não fornece jogos protegidos por direitos autorais nem links para baixá-los. Use apenas jogos que você tem o direito de usar: os da loja do Vortex, jogos livres, e cópias de jogos que você comprou, quando a lei do seu país permitir. Você é o único responsável pelos arquivos que coloca no Vortex e por como os obteve." },
  { titulo: "3. Licença e assinatura", texto: "O Vortex é um aplicativo licenciado, não vendido. O uso é liberado pelo seu Vetorial ID: 7 dias grátis junto com o teste da Vênus e, depois, por um pacote que inclua o Vortex (Vênus + Vortex ou o pacote completo). A licença é pessoal e não pode ser revendida nem compartilhada. O dono do projeto pode ajustar planos e preços, avisando antes de cobrar." },
  { titulo: "4. Aparelhos", texto: "Cada conta pode ter até 3 aparelhos vinculados e usar até 2 ao mesmo tempo. Para vincular um quarto aparelho, remova um dos anteriores." },
  { titulo: "5. Saves na nuvem", texto: "Se você entrar com o Vetorial ID, os saves dos seus jogos são enviados para a nuvem da Vetorial Tech e ficam ligados à sua conta, para você continuar de onde parou em outro aparelho. Cada conta tem 256 MB. Quando o save mudou em dois aparelhos, o Vortex pergunta qual manter e guarda uma cópia do que for trocado. Você pode sair da conta quando quiser; os saves continuam no seu aparelho." },
  { titulo: "6. Controle e outros apps", texto: "No Android, o serviço opcional “Vortex Controle” usa a acessibilidade apenas para tocar na tela quando você aperta um botão do controle, em jogos que você escolheu. Ele não lê o conteúdo da tela. Para a ponte com a Vênus (“Vênus, abra o jogo X”), o Vortex precisa estar aberto e com a sua conta." },
  { titulo: "7. Downloads e internet", texto: "Na primeira vez de cada console o Vortex baixa o motor de emulação, de fontes oficiais, e na loja baixa os jogos conferindo a integridade do arquivo. Isso usa a sua internet. Os motores de emulação são software livre de terceiros e seguem as licenças deles." },
  { titulo: "8. Garantias", texto: "O Vortex é oferecido como está. O desempenho depende do seu aparelho, e alguns consoles pesados podem rodar mal em aparelhos fracos. A Vetorial Tech não se responsabiliza por perda de saves, por jogos de terceiros nem por uso em desacordo com a lei." },
  { titulo: "9. Mudanças", texto: "Estes termos podem mudar. Quando mudarem, o Vortex pede que você aceite de novo antes de continuar." },
];

export function termosAceitos(): boolean {
  try { return localStorage.getItem(CHAVE) === String(VERSAO_DOS_TERMOS); } catch { return false; }
}
export function aceitarTermos() {
  try { localStorage.setItem(CHAVE, String(VERSAO_DOS_TERMOS)); } catch { /* sem armazenamento: pede de novo na próxima vez */ }
}

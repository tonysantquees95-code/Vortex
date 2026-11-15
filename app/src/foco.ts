import { useEffect } from "react";
import { analogicoRola } from "./config";
import { lerId, normalizar, perfilAtivoDe, estaEscutando } from "./controle";
import { acaoDaTecla, direcoesDoControle, proximoFoco, type Candidato, type Direcao } from "./navegacao";

/** Elementos que podem receber foco: o que estiver na camada de cima (modal) ou, sem modal, a tela inteira. */
function focaveis(): HTMLElement[] {
  const camadas = document.querySelectorAll<HTMLElement>("[data-camada]");
  const raiz = camadas.length ? camadas[camadas.length - 1] : document;
  return Array.from(raiz.querySelectorAll<HTMLElement>("[data-foco]")).filter((e) => e.offsetParent !== null && !(e as HTMLButtonElement).disabled);
}

/** Primeiro item que não seja campo de texto (focar um campo abre o teclado do celular sem ninguém pedir). */
export function primeiroSemCampo(lista: HTMLElement[]): HTMLElement | undefined {
  return lista.find((e) => e.tagName !== "INPUT" && e.tagName !== "TEXTAREA") ?? undefined;
}

export function focar(el: HTMLElement) {
  el.focus({ preventScroll: true });
  el.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" });
}

export function mover(direcao: Direcao) {
  const lista = focaveis();
  if (!lista.length) return;
  const atual = document.activeElement as HTMLElement | null;
  if (!atual || !lista.includes(atual)) { focar(primeiroSemCampo(lista) ?? lista[0]); return; }
  const r = atual.getBoundingClientRect();
  const cands: Candidato[] = lista.filter((e) => e !== atual).map((e, i) => {
    e.dataset.idx = String(i);
    const b = e.getBoundingClientRect();
    return { id: String(i), caixa: { x: b.x, y: b.y, w: b.width, h: b.height } };
  });
  const id = proximoFoco({ x: r.x, y: r.y, w: r.width, h: r.height }, cands, direcao);
  if (id !== null) {
    const alvo = lista.filter((e) => e !== atual)[Number(id)];
    if (alvo) focar(alvo);
  }
}

/** Quem rola: o primeiro ancestral do item focado que tenha rolagem; sem isso, a página. */
function rolavel(): HTMLElement {
  let e = document.activeElement as HTMLElement | null;
  while (e && e !== document.body) {
    const o = getComputedStyle(e).overflowY;
    if ((o === "auto" || o === "scroll") && e.scrollHeight > e.clientHeight + 4) return e;
    e = e.parentElement;
  }
  return (document.scrollingElement as HTMLElement) ?? document.documentElement;
}

const avisar = (nome: string, detalhe?: unknown) => window.dispatchEvent(new CustomEvent(nome, { detail: detalhe }));

/** Liga teclado e controle. Eventos: "vortex:voltar", "vortex:aba" (detail -1/+1), "vortex:favorito", "vortex:controle" (detail boolean). */
export function useNavegacao() {
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const alvo = e.target as HTMLElement | null;
      const digitando = alvo?.tagName === "INPUT" || alvo?.tagName === "TEXTAREA" || !!alvo?.isContentEditable;
      const acao = acaoDaTecla(e.key, digitando);
      if (!acao) return;
      if (acao.tipo === "mover") { e.preventDefault(); mover(acao.direcao); return; }
      if (acao.tipo === "evento") { avisar(acao.nome, acao.detalhe); return; }
      // Enter: botões e links já abrem sozinhos; os outros itens da tela (cartões de jogo) recebem o clique aqui
      const atual = document.activeElement as HTMLElement | null;
      if (atual?.hasAttribute("data-foco") && !["BUTTON", "A", "LABEL", "INPUT", "SELECT", "TEXTAREA", "SUMMARY"].includes(atual.tagName)) { e.preventDefault(); atual.click(); }
    };
    let quadro = 0;
    const anterior = new Map<string, boolean>();
    let ultimoMov = 0;
    let ultimoQuadro = 0;
    let conectado = false;
    window.addEventListener("keydown", tecla);
    // o Chromium só entrega o controle à janela que tem o foco e depois de um botão apertado: ao voltar de um jogo (ou do Alt+Tab),
    // reinicia a leitura do zero para o primeiro botão apertado já ser reconhecido
    const reiniciar = () => { conectado = false; anterior.clear(); ultimoMov = 0; try { window.focus(); } catch { /* sem foco */ } };
    const aoConectar = () => reiniciar();
    window.addEventListener("focus", reiniciar);
    window.addEventListener("gamepadconnected", aoConectar);
    window.addEventListener("gamepaddisconnected", aoConectar);
    window.addEventListener("vortex:jogo-fechou", reiniciar);
    document.addEventListener("visibilitychange", reiniciar);

    const ler = (agora: number) => {
      const pad = (navigator.getGamepads?.() ?? []).find((g) => g && g.connected) ?? null;
      if (!!pad !== conectado) { conectado = !!pad; avisar("vortex:controle", conectado); }
      if (pad && !estaEscutando()) {
        const perfil = perfilAtivoDe(lerId(pad.id));
        const norm = normalizar(perfil?.mapa ?? null, pad.buttons.map((b) => b.pressed), Array.from(pad.axes));
        const botoes = norm.botoes;
        // opção "analógico rola a página": o analógico esquerdo sobe e desce a tela e só o direcional escolhe os itens
        const rola = analogicoRola();
        const eixos = norm.eixos;
        const dirs = direcoesDoControle(botoes, rola ? [0, 0] : eixos);
        if (rola) {
          const y = eixos[1] ?? 0;
          const dt = Math.min(50, ultimoQuadro ? agora - ultimoQuadro : 16);
          if (Math.abs(y) > 0.25) rolavel().scrollBy({ top: Math.sign(y) * (Math.abs(y) - 0.25) * 1.33 * dt * 1.1, behavior: "auto" });
        }
        ultimoQuadro = agora;
        if (dirs.length && agora - ultimoMov > (anterior.get("mov") ? 170 : 360)) {
          mover(dirs[0]); ultimoMov = agora; anterior.set("mov", true);
        }
        if (!dirs.length) anterior.set("mov", false);
        const borda = (i: number, nome: string, f: () => void) => {
          const antes = anterior.get(nome) ?? false;
          if (botoes[i] && !antes) f();
          anterior.set(nome, !!botoes[i]);
        };
        borda(0, "A", () => (document.activeElement as HTMLElement | null)?.click());
        borda(1, "B", () => avisar("vortex:voltar"));
        borda(3, "Y", () => avisar("vortex:favorito"));
        borda(2, "X", () => avisar("vortex:atualizar-biblioteca"));
        borda(9, "Start", () => avisar("vortex:atualizacao"));
        borda(4, "LB", () => avisar("vortex:aba", -1));
        borda(5, "RB", () => avisar("vortex:aba", 1));
      }
      quadro = requestAnimationFrame(ler);
    };
    quadro = requestAnimationFrame(ler);
    return () => {
      window.removeEventListener("keydown", tecla); cancelAnimationFrame(quadro);
      window.removeEventListener("focus", reiniciar); window.removeEventListener("gamepadconnected", aoConectar); window.removeEventListener("gamepaddisconnected", aoConectar);
      window.removeEventListener("vortex:jogo-fechou", reiniciar); document.removeEventListener("visibilitychange", reiniciar);
    };
  }, []);
}

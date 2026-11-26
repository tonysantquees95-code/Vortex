import { useDeferredValue, memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { ErroApi, api } from "../api";
import { pontuacaoLocal } from "../pontuacao";
import { aquecerDitado, iniciarDitado, type Ditado } from "../ditado";
import { useVoxix } from "../estado";
import { Icone } from "../icones";
import { PapelDeParede } from "../papel";
import { usePapelDaConversa } from "../papelConversa";
import { Teclado } from "../Teclado";
import { BarraSugestoes } from "../BarraSugestoes";
import type { ReactNode } from "react";
import { apagar as apagarTexto, comecaFrase, inserir, type Edicao } from "../edicaoTeclado";
import { SEPARADORES, aplicarSeparador, corrigirFim, desfazerCorrecao, palavraAntesDoCursor, sugerir, trocarPalavra, type Correcao } from "../corretor";
import { aprender, palavrasDaPessoa, useCorretor } from "../useCorretor";
import { mudarTeclado } from "../personalizar";
import { useVisual } from "../useVisual";

/** Altura máxima do campo de mensagem: cresce com as linhas e, passando disso, rola por dentro. */
const ALTURA_MAX_CAMPO = 168;

// Perguntados uma vez só: matchMedia a cada letra era trabalho à toa.
const midia = (q: string) => typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia(q).matches;
const TELA_DE_TOQUE = midia("(pointer: coarse)");
const MOUSE_E_TECLADO = midia("(pointer: fine)");
/** O navegador mede sozinho a altura do campo (sem a gente forçar o cálculo da tela a cada letra). */
const CAMPO_AUTOMATICO = typeof CSS !== "undefined" && typeof CSS.supports === "function" && CSS.supports("field-sizing", "content");

const SEM_OPCOES: string[] = [];

/** A lista fica separada para não ser refeita (balão por balão) a cada letra digitada. */
const ListaMensagens = memo(function ListaMensagens({ mensagens, aoReenviar }: { mensagens: MsgChat[]; aoReenviar: (id: string, corpo: string) => void }) {
  return (
    <>
      {mensagens.map((m) => (
        <div key={m.id} className={`flex ${m.minha ? "justify-end" : "justify-start"}`}>
          <div className={`balao max-w-[80%] whitespace-pre-wrap break-words px-3.5 py-2 text-[15px] ${m.minha ? "balao-meu" : "border border-borda bg-painel"}`}>
            {m.autor && !m.minha && <div className="mb-0.5 text-xs font-bold text-neon">@{m.autor}</div>}
            {m.corpo}
            <div className={`mt-0.5 text-right text-[10px] ${m.minha ? "text-white/70" : "text-suave"}`}>
              {horaMsg(m.criado)}{m.minha && (m.estado === "enviando" ? " · enviando…" : m.estado === "enviada" ? " ✓" : "")}
              {m.estado === "falhou" && <button onClick={() => aoReenviar(m.id, m.corpo)} className="ml-1 font-bold underline">não enviada · tentar de novo</button>}
            </div>
          </div>
        </div>
      ))}
    </>
  );
});

const horaMsg = (t: number): string => new Date(t).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

export interface MsgChat { id: string; minha: boolean; corpo: string; criado: number; estado: "enviando" | "enviada" | "falhou"; autor?: string }
export interface ItemMenu { rotulo: string; perigo?: boolean; aoTocar: (avisar: (t: string) => void) => void }
export interface PropsChat {
  chave: string; // muda quando troca de conversa/sala: limpa o campo
  titulo: string;
  subtitulo?: ReactNode;
  avatar: ReactNode;
  aoVoltar: () => void;
  mensagens: MsgChat[];
  vazio: string;
  menu?: ItemMenu[];
  aoEnviar: (texto: string) => Promise<void>;
  aoReenviar: (id: string, corpo: string) => Promise<void>;
  cabecalhoExtra?: ReactNode; // faixa embaixo do cabeçalho (ex.: quem está online)
  extra?: (avisar: (t: string) => void) => ReactNode; // janelas (ex.: denúncia)
  acoes?: ReactNode; // botões ao lado do menu
}

export function ChatBase({ chave: apelido, titulo, subtitulo, avatar, aoVoltar, mensagens, vazio, menu = [], aoEnviar, aoReenviar, cabecalhoExtra, extra, acoes }: PropsChat) {
  const { sessao } = useVoxix();
  const [texto, setTexto] = useState("");
  const [cursor, setCursor] = useState(0);
  const textoRef = useRef("");
  const ultimaCorrecao = useRef<Correcao | null>(null);
  const [desfazer, setDesfazer] = useState<Correcao | null>(null); // a troca automática mais recente: a faixa de sugestões oferece a palavra original
  const marcar = (c: Correcao | null) => { ultimaCorrecao.current = c; setDesfazer(c); };
  const [aviso, setAviso] = useState("");
  const [menuAberto, setMenu] = useState(false);
  const papelProprio = usePapelDaConversa(apelido);
  const [ouvindo, setOuvindo] = useState(false);
  const [preparando, setPreparando] = useState(false);
  const enviandoRef = useRef(false);
  const ditado = useRef<Ditado | null>(null);
  const caixa = useRef<HTMLTextAreaElement>(null);
  const visual = useVisual();
  const [tecladoAberto, setTecladoAberto] = useState(false);
  // teclado do Voxix: no celular sempre que ligado; no computador só se a pessoa pedir
  const proprio = visual.teclado.usar && (visual.teclado.noPc || TELA_DE_TOQUE);
  const fim = useRef<HTMLDivElement>(null);
  const corretorLigado = visual.teclado.corretor;
  const dic = useCorretor(corretorLigado);
  const dicRef = useRef(dic);
  dicRef.current = dic;
  // computador (mouse e teclado físico): a faixa de sugestões flutua em cima do campo
  const tecladoFisico = MOUSE_E_TECLADO;
  const campoCheio = useRef(false);
  const alturaCampo = useRef(0);
  const textoAnterior = useRef("");
  const cursorPendente = useRef<number | null>(null);

  useEffect(() => { fim.current?.scrollIntoView({ block: "end" }); }, [mensagens.length, apelido]);
  useEffect(() => () => { void ditado.current?.parar(); }, [apelido]);
  useEffect(() => { aquecerDitado(); }, []);
  useEffect(() => { textoRef.current = ""; marcar(null); setTexto(""); setCursor(0); setAviso(""); setMenu(false); }, [apelido]);

  // Depois que o texto novo entra no campo, o cursor vai para o lugar certo na mesma hora (sem esperar o próximo quadro:
  // quem digita rápido não pode ver letra caindo no lugar errado).
  useLayoutEffect(() => {
    const pos = cursorPendente.current;
    if (pos === null) return;
    cursorPendente.current = null;
    try { caixa.current?.setSelectionRange(pos, pos); } catch { /* campo fora da tela */ }
  });

  // O campo acompanha o que se escreve: cresce linha a linha até o limite e depois rola, sem esconder o texto.
  // Com `field-sizing: content` só precisamos rolar as mensagens quando o campo muda de tamanho (e isso não custa nada a cada letra).
  useEffect(() => {
    const el = caixa.current;
    if (!CAMPO_AUTOMATICO || !el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver((entradas) => {
      const alto = entradas[entradas.length - 1]?.borderBoxSize?.[0]?.blockSize ?? el.offsetHeight;
      campoCheio.current = alto >= ALTURA_MAX_CAMPO - 1;
      if (campoCheio.current) el.scrollTop = el.scrollHeight; // chegou no máximo: daqui em diante o texto rola por dentro
      fim.current?.scrollIntoView({ block: "end" });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  // Campo no tamanho máximo: acompanha o cursor (o navegador não rola sozinho quando o texto entra pelo teclado do Voxix).
  useLayoutEffect(() => {
    const el = caixa.current;
    if (!CAMPO_AUTOMATICO || !campoCheio.current || !el) return;
    if ((el.selectionStart ?? texto.length) >= texto.length) el.scrollTop = el.scrollHeight;
  }, [texto]);
  useEffect(() => { // depois de desenhar a letra (não trava o toque seguinte)
    if (CAMPO_AUTOMATICO) return;
    const el = caixa.current;
    if (!el) return;
    // digitar sem quebrar linha não muda a altura: pula a medição pesada (só mede ao crescer ou ao apagar)
    const antes = textoAnterior.current;
    textoAnterior.current = texto;
    if (texto.length >= antes.length && el.scrollHeight <= el.clientHeight && alturaCampo.current) return;
    el.style.height = "auto";
    const borda = el.offsetHeight - el.clientHeight;
    const cheio = el.scrollHeight + borda > ALTURA_MAX_CAMPO;
    const h = Math.min(el.scrollHeight + borda, ALTURA_MAX_CAMPO);
    el.style.height = `${h}px`;
    el.style.overflowY = cheio ? "auto" : "hidden";
    if (cheio && (el.selectionStart ?? texto.length) >= texto.length) el.scrollTop = el.scrollHeight;
    if (alturaCampo.current && alturaCampo.current !== h) fim.current?.scrollIntoView({ block: "end" });
    alturaCampo.current = h;
  }, [texto]);

  // ---- escrita: tudo aqui é estável (não muda a cada letra) para o teclado não ser refeito a cada toque ----
  const lerSelecao = useCallback((): [number, number] => {
    const el = caixa.current;
    const n = textoRef.current.length;
    if (el && document.activeElement === el) return [el.selectionStart ?? n, el.selectionEnd ?? n];
    return [n, n];
  }, []);
  const aplicar = useCallback((r: Edicao) => {
    const t = r.texto.slice(0, 2000);
    const pos = Math.min(r.pos, t.length);
    textoRef.current = t;
    setTexto(t);
    setCursor(pos);
    cursorPendente.current = pos; // posto no campo logo depois de desenhar (abaixo), antes da próxima tecla
  }, []);
  const inserirTexto = useCallback((x: string) => {
    const [i, j] = lerSelecao();
    const t = textoRef.current;
    const d = dicRef.current;
    if (d && SEPARADORES.has(x)) { // espaço, ponto, vírgula…: conserta a palavra que acabou de ser escrita
      const r = aplicarSeparador(d, palavrasDaPessoa(), t, i, j, x);
      marcar(r.correcao);
      aplicar(r);
      return;
    }
    marcar(null);
    aplicar(inserir(t, i, j, x));
  }, [aplicar, lerSelecao]);
  const apagarCaractere = useCallback(() => {
    const [i, j] = lerSelecao();
    const t = textoRef.current;
    marcar(null); // apagar só apaga: a palavra corrigida não volta ao que estava
    aplicar(apagarTexto(t, i, j));
  }, [aplicar, lerSelecao]);
  const escolherSugestao = useCallback((palavra: string, literal: boolean) => {
    const [i] = lerSelecao();
    const c = ultimaCorrecao.current;
    marcar(null);
    if (c && literal && palavra === c.original) { // tocou na palavra original logo depois da troca: desfaz e o corretor aprende a deixar assim
      const r = desfazerCorrecao(textoRef.current, i, c);
      if (r) { aprender(c.original); aplicar(r); return; }
    }
    if (literal) aprender(palavra); // tocar na palavra como foi escrita: o corretor aprende a deixar assim
    aplicar(trocarPalavra(textoRef.current, i, palavra));
  }, [aplicar, lerSelecao]);

  // teclado físico (computador): mesma correção ao dar espaço ou pontuação, e Backspace desfaz
  const aoTeclar = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    const d = dicRef.current;
    if (!d || e.nativeEvent.isComposing || e.ctrlKey || e.metaKey || e.altKey) return;
    const t = e.currentTarget.value;
    const i = e.currentTarget.selectionStart;
    const j = e.currentTarget.selectionEnd;
    if (e.key === "Backspace") marcar(null);
    const sep = e.key === "Enter" ? "\n" : e.key;
    if (sep.length === 1 && SEPARADORES.has(sep)) {
      const r = aplicarSeparador(d, palavrasDaPessoa(), t, i, j, sep);
      marcar(r.correcao);
      if (r.correcao) { e.preventDefault(); aplicar(r); }
    }
  };

  // as sugestões podem chegar um quadro depois: a letra digitada nunca espera por elas
  const textoSug = useDeferredValue(texto);
  const cursorSug = useDeferredValue(cursor);
  const palavra = useMemo(() => (dic ? palavraAntesDoCursor(textoSug, cursorSug) : null), [dic, textoSug, cursorSug]);
  const sugestoes = useMemo(() => {
    if (!dic || !palavra || !palavra.palavra || /[\d@#_/\\:]/.test(palavra.trecho)) return null;
    return sugerir(dic, palavra.palavra, palavrasDaPessoa());
  }, [dic, palavra]);
  const literal = (sugestoes && !sugestoes.valida && palavra ? palavra.palavra : null) ?? (desfazer && !palavra?.palavra ? desfazer.original : null);
  const opcoes = sugestoes?.opcoes ?? SEM_OPCOES;

  const mandarRef = useRef<() => Promise<void>>(async () => {});
  const enviarTecla = useCallback(() => { void mandarRef.current(); }, []);
  const reenviarRef = useRef(aoReenviar);
  reenviarRef.current = aoReenviar;
  const reenviarMsg = useCallback((id: string, corpo: string) => {
    void reenviarRef.current(id, corpo).catch(() => setAviso("Ainda não consegui enviar."));
  }, []);

  const mandar = async () => {
    let t = textoRef.current.trim();
    if (!t) return;
    if (dicRef.current) t = corrigirFim(dicRef.current, palavrasDaPessoa(), t).trim(); // conserta também a última palavra
    if (ouvindo) { enviandoRef.current = true; await ditado.current?.parar(); enviandoRef.current = false; }
    textoRef.current = "";
    marcar(null);
    setTexto("");
    setCursor(0);
    setAviso("");
    try { await aoEnviar(t); } catch (e) { setAviso(e instanceof ErroApi ? e.message : "Não consegui enviar. Toque na mensagem para tentar de novo."); }
  };
  mandarRef.current = mandar;

  // Troca entre o teclado do Voxix e o do celular; fecha e abre o campo para o aparelho mostrar o teclado certo.
  const trocarTeclado = () => {
    const usarOVoxix = !visual.teclado.usar;
    mudarTeclado({ usar: usarOVoxix });
    caixa.current?.blur();
    window.setTimeout(() => { caixa.current?.focus(); setTecladoAberto(true); }, 60);
  };

  const alternarMicrofone = async () => {
    if (ouvindo) { await ditado.current?.parar(); return; }
    if (!sessao) return;
    setAviso("");
    const base = textoRef.current.trim();
    let falado = "";
    const montar = (parte: string) => (base ? `${base} ${parte}` : parte);
    try {
      setOuvindo(true);
      setPreparando(true);
      ditado.current = await iniciarDitado({
        aoPronto: () => setPreparando(false),
        aoTexto: (t) => { falado = t; const x = montar(t); aplicar({ texto: x, pos: x.length }); },
        aoFim: () => {
          setOuvindo(false); setPreparando(false); ditado.current = null;
          if (!falado.trim() || enviandoRef.current) return;
          // pontuação na hora (no aparelho) e, em seguida, a versão mais cuidadosa do servidor
          const cru = montar(falado);
          if (textoRef.current !== cru) return; // a pessoa mexeu no texto: não mexemos
          const local = montar(pontuacaoLocal(falado));
          aplicar({ texto: local, pos: local.length });
          void api.pontuar(sessao.token, falado).then((r) => {
            if (!r.ajustado || textoRef.current !== local || enviandoRef.current) return;
            const x = montar(r.texto);
            aplicar({ texto: x, pos: x.length });
          }).catch(() => undefined);
        },
        aoErro: (m) => setAviso(m),
      }, sessao.token);
    } catch (e) {
      setOuvindo(false);
      setPreparando(false);
      setAviso(e instanceof Error ? e.message : "Não consegui usar o microfone.");
    }
  };

  return (
    <>
      <header className="flex items-center gap-3 border-b border-borda bg-painel px-3 py-2.5">
        <button onClick={aoVoltar} aria-label="Voltar" className="grid h-9 w-9 place-items-center rounded-full text-xl md:hidden"><Icone nome="voltar" tam={22} /></button>
        {avatar}
        <div className="min-w-0 flex-1"><div className="truncate font-bold leading-tight">{titulo}</div>{subtitulo && <div className="truncate text-xs text-suave">{subtitulo}</div>}</div>
        {acoes}
        {menu.length > 0 && (
          <div className="relative">
            <button onClick={() => setMenu((m) => !m)} aria-label="Mais opções" className="grid h-9 w-9 place-items-center rounded-full text-xl"><Icone nome="mais" tam={22} /></button>
            {menuAberto && (
              <div className="absolute right-0 top-10 z-10 w-56 overflow-hidden rounded-xl border border-borda bg-painel text-sm shadow-xl">
                {menu.map((i) => <button key={i.rotulo} onClick={() => { setMenu(false); i.aoTocar(setAviso); }} className={`block w-full px-4 py-3 text-left hover:bg-white/5 ${i.perigo ? "text-erro" : ""}`}>{i.rotulo}</button>)}
              </div>
            )}
          </div>
        )}
      </header>
      {cabecalhoExtra}

      <div className="relative min-h-0 flex-1"><PapelDeParede qual="conversa" cfg={papelProprio?.cfg} fotoUrl={papelProprio ? papelProprio.foto : undefined} />
      <div className="rolagem absolute inset-0 z-[1] space-y-1.5 overflow-y-auto px-3 py-3">
        {mensagens.length === 0 && <p className="py-10 text-center text-sm text-suave">{vazio}</p>}
        <ListaMensagens mensagens={mensagens} aoReenviar={reenviarMsg} />
        <div ref={fim} />
      </div></div>

      {aviso && <p className="px-4 pb-1 text-xs text-aviso" role="status">{aviso}</p>}
      {ouvindo && (
        <div className="border-t border-borda bg-painel px-3 pt-2 text-xs text-suave" role="status" aria-live="polite">
          {preparando ? "Preparando o microfone…" : "Fale agora. Toque no quadrado para pausar."}
          {preparando && <div className="carregando-mic mt-1.5" />}
        </div>
      )}
      <form onSubmit={(e) => { e.preventDefault(); void mandar(); }} className="relative flex items-end gap-2 border-t border-borda bg-painel p-2.5">
        {corretorLigado && !proprio && tecladoFisico && <BarraSugestoes flutuante literal={literal} opcoes={opcoes} aoEscolher={escolherSugestao} />}
        <button type="button" onClick={() => void alternarMicrofone()} aria-label={ouvindo ? "Pausar o ditado" : "Ditar mensagem"} title={ouvindo ? "Toque para pausar. O texto fica no campo para você enviar." : "Ditado: fale e a fala vira texto"} className={`botao-redondo grid h-11 w-11 flex-none place-items-center border ${ouvindo ? "gravando border-magenta bg-magenta text-[#1a0620]" : "border-borda text-neon"}`}><Icone nome={ouvindo ? "parar" : "microfone"} tam={22} /></button>
        {TELA_DE_TOQUE && (
          <button type="button" onClick={trocarTeclado} aria-label={visual.teclado.usar ? "Usar o teclado do celular" : "Usar o teclado do Voxix"} title={visual.teclado.usar ? "Usar o teclado do celular" : "Usar o teclado do Voxix"} className="botao-redondo grid h-11 w-11 flex-none place-items-center border border-borda text-neon"><Icone nome="teclado" tam={22} /></button>
        )}
        <textarea ref={caixa} inputMode={proprio ? "none" : undefined} onFocus={() => setTecladoAberto(true)} onClick={() => setTecladoAberto(true)} value={texto}
          onChange={(e) => { marcar(null); textoRef.current = e.target.value; setTexto(e.target.value); setCursor(e.target.selectionStart ?? e.target.value.length); }}
          onSelect={(e) => setCursor(e.currentTarget.selectionStart ?? 0)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && window.matchMedia("(min-width: 768px)").matches) { e.preventDefault(); void mandar(); return; } aoTeclar(e); }}
          rows={1} maxLength={2000} placeholder={ouvindo ? (preparando ? "Preparando…" : "Fale agora…") : "Mensagem"} lang="pt-BR" autoCapitalize="sentences" autoCorrect={proprio ? "off" : "on"} spellCheck={!proprio && !(corretorLigado && tecladoFisico)}
          style={{ maxHeight: ALTURA_MAX_CAMPO }} className={`balao min-h-11 min-w-0 flex-1 resize-none [overflow-wrap:anywhere] border border-borda bg-fundo px-4 py-2.5 leading-6 outline-none focus:border-neon ${CAMPO_AUTOMATICO ? "field-sizing-content overflow-y-auto" : "overflow-hidden"}`} />
        <button disabled={!texto.trim()} className="botao-redondo grid h-11 w-11 flex-none place-items-center bg-neon text-lg font-bold text-white disabled:opacity-40" aria-label="Enviar"><Icone nome="enviar" tam={22} /></button>
      </form>
      {proprio && tecladoAberto && (
        <>
          <button type="button" onClick={() => { setTecladoAberto(false); caixa.current?.blur(); }} className="w-full border-t border-borda bg-painel py-1 text-xs text-suave" aria-label="Fechar o teclado"><span className="inline-flex items-center gap-1"><Icone nome="teclado" tam={14} /> fechar teclado</span></button>
          {corretorLigado && <BarraSugestoes literal={literal} opcoes={opcoes} aoEscolher={escolherSugestao} />}
          <Teclado aoInserir={inserirTexto} aoApagar={apagarCaractere} aoEnviar={enviarTecla} inicioDeFrase={comecaFrase(texto, cursor)} podeEnviar={!!texto.trim()} />
        </>
      )}

      {extra?.(setAviso)}
    </>
  );
}

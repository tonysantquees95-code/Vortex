import { useRef, useState, type PointerEvent, type ReactNode } from "react";
import { PACOTES } from "../emojis";
import { Icone, type NomeIcone } from "../icones";
import { Logo } from "../logo";
import { PapelDeParede, fotoDo, guardarFoto, reduzirImagem, useFoto, type Qual } from "../papel";
import {
  AJUSTE_MAX, FORMATOS, pontasDoDesvio, MODELOS_PAPEL, MODOS_LUZ, TEMAS, coresDe, hexDe, hexValido, mudarIcones, mudarLuz, mudarPapel, mudarTeclado, mudarVisual, restaurarVisual, rgbDe,
  type CorLed, type EfeitoToque, type FormaTecla, type Formato, type ModeloPapel,
} from "../personalizar";
import { Teclado } from "../Teclado";
import { useVisual } from "../useVisual";

type Aba = "cores" | "formato" | "icones" | "fundo" | "emojis" | "teclado";
const ABAS: { id: Aba; nome: string; icone: NomeIcone }[] = [
  { id: "cores", nome: "Cores", icone: "cores" }, { id: "formato", nome: "Formato", icone: "formato" }, { id: "icones", nome: "Ícones", icone: "estrela" },
  { id: "fundo", nome: "Fundo", icone: "fundo" }, { id: "emojis", nome: "Emojis", icone: "emoji" }, { id: "teclado", nome: "Teclado", icone: "teclado" },
];

function Chip({ ativo, onClick, children, rotulo, cheio }: { ativo: boolean; onClick: () => void; children: ReactNode; rotulo?: string; cheio?: boolean }) {
  return (
    <button type="button" role="radio" aria-checked={ativo} aria-label={rotulo} onClick={onClick}
      className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-2 text-sm ${cheio ? "w-full" : ""} ${ativo ? "border-neon bg-neon/15 font-bold text-texto" : "border-borda text-suave"}`}>{children}</button>
  );
}
function Interruptor({ ligado, aoMudar, titulo, dica }: { ligado: boolean; aoMudar: (v: boolean) => void; titulo: string; dica?: string }) {
  return (
    <label className="flex items-center justify-between gap-3 text-sm">
      <span>{titulo}{dica && <span className="block text-xs text-suave">{dica}</span>}</span>
      <input type="checkbox" checked={ligado} onChange={(e) => aoMudar(e.target.checked)} className="h-5 w-5 flex-none accent-[var(--color-neon)]" />
    </label>
  );
}

/** Escolhe uma cor mexendo no vermelho, verde e azul (ou digitando o código). */
function SeletorRgb({ valor, aoMudar }: { valor: string; aoMudar: (hex: string) => void }) {
  const [r, g, b] = rgbDe(hexValido(valor) ? valor : "#ef2b3d");
  const [texto, setTexto] = useState("");
  const [editando, setEditando] = useState(false);
  const canal = (nome: string, v: number, cor: string, troca: (n: number) => string) => (
    <label className="grid grid-cols-[1.2rem_1fr_2.2rem] items-center gap-2 text-xs text-suave">
      <b style={{ color: cor }}>{nome}</b>
      <input type="range" min={0} max={255} value={v} onChange={(e) => { setEditando(false); aoMudar(troca(Number(e.target.value))); }} aria-label={`Quantidade de ${nome}`}
        style={{ accentColor: cor }} />
      <span className="text-right tabular-nums">{v}</span>
    </label>
  );
  return (
    <div className="space-y-2 rounded-xl border border-borda p-3">
      <div className="flex items-center gap-3">
        <span className="h-10 w-10 flex-none rounded-lg border border-borda" style={{ background: hexDe(r, g, b) }} aria-hidden="true" />
        <input value={editando ? texto : hexDe(r, g, b)} onFocus={() => { setEditando(true); setTexto(hexDe(r, g, b)); }}
          onChange={(e) => { const t = e.target.value.startsWith("#") ? e.target.value : `#${e.target.value}`; setTexto(t); if (hexValido(t)) aoMudar(t.toLowerCase()); }}
          onBlur={() => setEditando(false)} maxLength={7} spellCheck={false} aria-label="Código da cor" className="w-28 rounded-lg border border-borda bg-fundo px-3 py-2 font-mono text-sm uppercase outline-none focus:border-neon" />
        <span className="text-xs text-suave">ou mexa nas barras</span>
      </div>
      {canal("R", r, "#ff4d5e", (n) => hexDe(n, g, b))}
      {canal("G", g, "#34d399", (n) => hexDe(r, n, b))}
      {canal("B", b, "#4d8dff", (n) => hexDe(r, g, n))}
    </div>
  );
}

function AbaCores() {
  const v = useVisual();
  const personalizada = hexValido(v.cor);
  const c = coresDe(v.cor);
  return (
    <div className="space-y-4">
      <div>
        <p className="mb-1 text-xs text-suave">Cores prontas</p>
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Cores prontas">
          {TEMAS.map((t) => (
            <Chip key={t.id} ativo={v.cor === t.id} onClick={() => mudarVisual({ cor: t.id })}>
              <span className="h-4 w-4 rounded-full" style={{ background: `linear-gradient(135deg, ${t.neon}, ${t.magenta})` }} />{t.nome}
            </Chip>
          ))}
        </div>
      </div>
      <div>
        <p className="mb-1 text-xs text-suave">Sua cor{personalizada ? " (em uso)" : ""}</p>
        <SeletorRgb valor={personalizada ? v.cor : c.neon} aoMudar={(h) => mudarVisual({ cor: h })} />
        <p className="mt-1 text-xs text-suave">A segunda cor (do emblema e das mensagens) é calculada a partir da sua.</p>
      </div>
      <div>
        <p className="mb-1 text-xs text-suave">Luz em volta do logo</p>
        <div className="grid gap-2" role="radiogroup" aria-label="Luz em volta do logo">
          {MODOS_LUZ.map((m) => (
            <button key={m.id} type="button" role="radio" aria-checked={v.luz.modo === m.id} onClick={() => mudarLuz({ modo: m.id })}
              className={`rounded-xl border p-3 text-left text-sm ${v.luz.modo === m.id ? "border-neon bg-neon/10" : "border-borda"}`}>
              <b className="block">{m.nome}</b><span className="block text-xs text-suave">{m.dica}</span>
            </button>
          ))}
        </div>
        {v.luz.modo === "cor" && <div className="mt-2"><SeletorRgb valor={v.luz.cor} aoMudar={(h) => mudarLuz({ cor: h })} /></div>}
      </div>
    </div>
  );
}

function AbaFormato() {
  const v = useVisual();
  return (
    <div className="space-y-3">
      <p className="text-sm text-suave">Muda a forma dos avatares, dos balões de mensagem e dos botões redondos (+, enviar, microfone, ajustes). O desenho dos ícones você escolhe na aba <b>Ícones</b>.</p>
      <div className="grid gap-2" role="radiogroup" aria-label="Formato dos ícones">
        {FORMATOS.map((f) => (
          <button key={f.id} type="button" role="radio" aria-checked={v.formato === f.id} onClick={() => mudarVisual({ formato: f.id as Formato })} data-formato={f.id}
            className={`flex items-center gap-3 rounded-xl border p-3 text-left ${v.formato === f.id ? "border-neon bg-neon/10" : "border-borda"}`}>
            <span className="avatar grid h-11 w-11 flex-none place-items-center bg-gradient-to-br from-neon to-magenta font-extrabold text-white">V</span>
            <span className="min-w-0 flex-1"><b className="block">{f.nome}</b><span className="block text-xs text-suave">{f.dica}</span></span>
            <span className="balao balao-meu px-3 py-1.5 text-xs">Oi!</span>
            <span className="botao-redondo grid h-8 w-8 flex-none place-items-center bg-neon text-sm text-white"><Icone nome="enviar" tam={18} /></span>
          </button>
        ))}
      </div>
    </div>
  );
}

const TODOS_ICONES: { nome: NomeIcone; rotulo: string }[] = [
  { nome: "config", rotulo: "Ajustes" }, { nome: "adicionar", rotulo: "Nova conversa" }, { nome: "enviar", rotulo: "Enviar" }, { nome: "microfone", rotulo: "Microfone" },
  { nome: "mais", rotulo: "Mais" }, { nome: "voltar", rotulo: "Voltar" }, { nome: "fechar", rotulo: "Fechar" }, { nome: "inicio", rotulo: "Início" },
  { nome: "teclado", rotulo: "Teclado" }, { nome: "emoji", rotulo: "Emoji" }, { nome: "apagar", rotulo: "Apagar" }, { nome: "shift", rotulo: "Maiúscula" },
];

function AbaIcones() {
  const v = useVisual();
  const i = v.icones;
  return (
    <div className="space-y-4">
      <p className="text-sm text-suave">Escolha como ficam os ícones do app: engrenagem, enviar, microfone, teclado e os outros.</p>
      <div className="grid grid-cols-4 gap-2 rounded-xl border border-borda p-3" aria-label="Prévia dos ícones">
        {TODOS_ICONES.map((t) => (
          <div key={t.nome} className="flex flex-col items-center gap-1 py-1 text-center text-[10px] text-suave">
            <span className="grid h-11 w-11 place-items-center text-texto"><Icone nome={t.nome} tam={28} /></span>{t.rotulo}
          </div>
        ))}
      </div>
      <div>
        <p className="mb-1 text-xs text-suave">Espessura do traço</p>
        <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Espessura">
          {([["fino", "Fino"], ["medio", "Médio"], ["grosso", "Grosso"]] as const).map(([id, nome]) => <Chip key={id} cheio ativo={i.traco === id} onClick={() => mudarIcones({ traco: id })}>{nome}</Chip>)}
        </div>
      </div>
      <div>
        <p className="mb-1 text-xs text-suave">Tamanho</p>
        <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Tamanho">
          {([["pequeno", "Pequeno"], ["medio", "Médio"], ["grande", "Grande"]] as const).map(([id, nome]) => <Chip key={id} cheio ativo={i.tamanho === id} onClick={() => mudarIcones({ tamanho: id })}>{nome}</Chip>)}
        </div>
      </div>
      <div>
        <p className="mb-1 text-xs text-suave">Estilo</p>
        <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Estilo">
          <Chip cheio ativo={i.estilo === "contorno"} onClick={() => mudarIcones({ estilo: "contorno" })}>Só contorno</Chip>
          <Chip cheio ativo={i.estilo === "suave"} onClick={() => mudarIcones({ estilo: "suave" })}>Com preenchimento</Chip>
        </div>
      </div>
      <div>
        <p className="mb-1 text-xs text-suave">Cor</p>
        <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Cor dos ícones">
          <Chip cheio ativo={i.cor === "texto"} onClick={() => mudarIcones({ cor: "texto" })}>Neutra</Chip>
          <Chip cheio ativo={i.cor === "app"} onClick={() => mudarIcones({ cor: "app" })}>Cor do app</Chip>
        </div>
      </div>
    </div>
  );
}

function AbaFundo() {
  const v = useVisual();
  const [qual, setQual] = useState<Qual>("inicio");
  const [aviso, setAviso] = useState("");
  const arquivo = useRef<HTMLInputElement>(null);
  const foto = useFoto(qual);
  const chave = qual === "inicio" ? "papelInicio" : "papelConversa";
  const papel = v[chave];

  const escolher = async (f: File | undefined) => {
    if (!f) return;
    setAviso("");
    try {
      const dados = await reduzirImagem(f);
      if (!guardarFoto(qual, dados)) { setAviso("Não deu para guardar a foto neste aparelho (pouco espaço)."); return; }
      mudarPapel(chave, { modelo: "foto" });
    } catch (e) { setAviso(e instanceof Error ? e.message : "Não consegui usar essa imagem."); }
  };
  const escolherModelo = (m: ModeloPapel) => {
    if (m === "foto" && !fotoDo(qual)) { arquivo.current?.click(); return; }
    mudarPapel(chave, { modelo: m });
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Qual tela">
        <Chip cheio ativo={qual === "inicio"} onClick={() => setQual("inicio")}>Tela inicial</Chip>
        <Chip cheio ativo={qual === "conversa"} onClick={() => setQual("conversa")}>Conversas</Chip>
      </div>
      <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Modelo do fundo">
        {MODELOS_PAPEL.map((m) => (
          <button key={m.id} type="button" role="radio" aria-checked={papel.modelo === m.id} onClick={() => escolherModelo(m.id)}
            className={`relative h-20 overflow-hidden rounded-xl border bg-fundo text-xs font-bold ${papel.modelo === m.id ? "border-neon" : "border-borda"}`}>
            {m.id === "foto" ? (foto && <div className="papel" style={{ backgroundImage: `url(${foto})` }} />) : m.id !== "nenhum" && <div className={`papel papel-${m.id}`} />}
            <span className="absolute inset-x-0 bottom-0 bg-black/55 py-1">{m.id === "foto" && !foto ? "＋ Escolher foto" : m.nome}</span>
          </button>
        ))}
      </div>
      <input ref={arquivo} type="file" accept="image/*" className="hidden" onChange={(e) => { void escolher(e.target.files?.[0]); e.target.value = ""; }} />
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => arquivo.current?.click()} className="rounded-xl border border-borda px-3 py-1.5 text-sm">{foto ? "Trocar a foto" : "Usar uma foto minha"}</button>
        {foto && <button type="button" onClick={() => { guardarFoto(qual, null); if (papel.modelo === "foto") mudarPapel(chave, { modelo: "nenhum" }); }} className="rounded-xl border border-erro px-3 py-1.5 text-sm text-erro">Remover a foto</button>}
      </div>
      <label className="grid gap-1 text-sm">Escurecer o fundo: {papel.escurecer}%
        <input type="range" min={0} max={85} step={5} value={papel.escurecer} onChange={(e) => mudarPapel(chave, { escurecer: Number(e.target.value) })} style={{ accentColor: "var(--color-neon)" }} aria-label="Quanto escurecer o fundo" />
      </label>
      <div className="relative h-28 overflow-hidden rounded-xl border border-borda bg-painel" aria-label="Prévia">
        <PapelDeParede qual={qual} />
        <div className="relative z-[1] space-y-1.5 p-3 text-xs">
          <div className="balao w-fit border border-borda bg-painel px-3 py-1.5">Prévia do fundo</div>
          <div className="balao balao-meu ml-auto w-fit px-3 py-1.5">Ficou bom!</div>
        </div>
      </div>
      {aviso && <p className="text-xs text-aviso" role="status">{aviso}</p>}
      <p className="text-xs text-suave">A foto fica só neste aparelho.</p>
    </div>
  );
}

function AbaEmojis() {
  const v = useVisual();
  return (
    <div className="space-y-3">
      <p className="text-sm text-suave">Pacotes prontos, sempre disponíveis no teclado do Voxix: toque no 😀 ao lado do espaço. Os que você mais usa ficam em “Recentes”.</p>
      {PACOTES.map((p) => (
        <section key={p.id} className="rounded-xl border border-borda p-3">
          <div className="flex items-center justify-between"><b className="text-sm">{p.icone} {p.nome}</b><span className="text-xs text-suave">{p.itens.length} emojis</span></div>
          <p className="mt-1 break-words text-xl leading-8">{p.itens.slice(0, 14).join(" ")}</p>
          <button type="button" onClick={() => mudarVisual({ pacoteEmoji: p.id })} className={`mt-1 text-xs ${v.pacoteEmoji === p.id ? "font-bold text-neon" : "text-suave underline"}`}>{v.pacoteEmoji === p.id ? "Abre primeiro no teclado" : "Abrir este primeiro"}</button>
        </section>
      ))}
    </div>
  );
}

/** Bolinhas onde a pessoa toca do jeito que digita; a média de quanto o dedo cai fora do centro vira o ajuste do teclado. */
const ALVOS: [number, number][] = [[0.14, 0.2], [0.5, 0.16], [0.86, 0.2], [0.3, 0.52], [0.7, 0.52], [0.14, 0.84], [0.5, 0.8], [0.86, 0.84]];
function AjusteDoToque() {
  const t = useVisual().teclado;
  const [fazendo, setFazendo] = useState(false);
  const [medidas, setMedidas] = useState<[number, number][]>([]);
  const area = useRef<HTMLDivElement>(null);
  const passo = medidas.length;
  const sem = !t.ajusteX && !t.ajusteY && !t.ajusteDirX && !t.ajusteDirY;
  const limitar = (n: number) => Math.max(-AJUSTE_MAX, Math.min(AJUSTE_MAX, Math.round(n)));
  const tocar = (e: PointerEvent<HTMLDivElement>) => {
    const a = area.current;
    if (!a) return;
    const r = a.getBoundingClientRect();
    const [fx, fy] = ALVOS[passo];
    const novas = [...medidas, [e.clientX - (r.left + r.width * fx), e.clientY - (r.top + r.height * fy)] as [number, number]];
    if (novas.length < ALVOS.length) { setMedidas(novas); return; }
    const fs = ALVOS.map((x) => x[0]);
    const [xe, xd] = pontasDoDesvio(fs, novas.map((m) => m[0]));
    const [ye, yd] = pontasDoDesvio(fs, novas.map((m) => m[1]));
    mudarTeclado({ ajusteX: limitar(xe), ajusteY: limitar(ye), ajusteDirX: limitar(xd), ajusteDirY: limitar(yd) });
    setMedidas([]);
    setFazendo(false);
  };
  const lado = (x: number, y: number) => `${Math.abs(x)} px ${x < 0 ? "para a esquerda" : "para a direita"} e ${Math.abs(y)} px ${y < 0 ? "para cima" : "para baixo"}`;
  const resumo = sem ? "Sem ajuste." : `Seu dedo cai, na ponta esquerda, ${lado(t.ajusteX, t.ajusteY)}; na ponta direita, ${lado(t.ajusteDirX, t.ajusteDirY)}. O teclado já compensa.`;
  return (
    <div className="space-y-2">
      <p className="text-sm">Ajustar o toque<span className="block text-xs text-suave">Se o teclado costuma pegar a tecla do lado, toque nas 8 bolinhas do jeito que você digita (com os polegares) e o Voxix passa a compensar. {resumo}</span></p>
      {fazendo ? (
        <>
          <div ref={area} onPointerDown={tocar} role="group" aria-label={`Toque na bolinha ${passo + 1} de ${ALVOS.length}`} className="relative h-44 touch-none select-none overflow-hidden rounded-xl border border-borda bg-fundo">
            <span className="pointer-events-none absolute h-10 w-10 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-neon bg-neon/20" style={{ left: `${ALVOS[passo][0] * 100}%`, top: `${ALVOS[passo][1] * 100}%` }} />
            <span className="pointer-events-none absolute bottom-1 right-2 text-xs text-suave">{passo + 1} de {ALVOS.length}</span>
          </div>
          <Chip ativo={false} onClick={() => { setFazendo(false); setMedidas([]); }}>Cancelar</Chip>
        </>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <Chip ativo={false} onClick={() => { setMedidas([]); setFazendo(true); }}>{sem ? "Ajustar agora" : "Ajustar de novo"}</Chip>
          <Chip ativo={false} onClick={() => mudarTeclado({ ajusteX: 0, ajusteY: 0, ajusteDirX: 0, ajusteDirY: 0 })}>Zerar</Chip>
        </div>
      )}
    </div>
  );
}

function AbaTeclado() {
  const v = useVisual();
  const t = v.teclado;
  const [prova, setProva] = useState("");
  const formas: { id: FormaTecla; nome: string }[] = [{ id: "redonda", nome: "Redondinho" }, { id: "quadrada", nome: "Quadradinho" }, { id: "futurista", nome: "Futurista" }];
  const efeitos: { id: EfeitoToque; nome: string }[] = [{ id: "nenhum", nome: "Desligadas" }, { id: "brilho", nome: "Brancas" }, { id: "rgb", nome: "RGB" }, { id: "cor", nome: "Cor do app" }];
  return (
    <div className="space-y-4">
      <Interruptor ligado={t.usar} aoMudar={(x) => mudarTeclado({ usar: x })} titulo="Usar o teclado do Voxix" dica="Ligado: o teclado do app, no mesmo estilo. Desligado: o teclado do seu celular (Gboard ou o que você usa), com o corretor dele. Também dá para trocar pelo botão de teclado ao lado do microfone, na conversa." />
      <Interruptor ligado={t.noPc} aoMudar={(x) => mudarTeclado({ noPc: x })} titulo="Mostrar também no computador" dica="Normalmente ele aparece só em telas de toque." />
      <Interruptor ligado={t.corretor} aoMudar={(x) => mudarTeclado({ corretor: x })} titulo="Corretor automático em português" dica="Sugere palavras em cima do teclado e corrige acentos e erros ao dar espaço. Funciona no celular e no computador." />
      <div>
        <p className="mb-1 text-xs text-suave">Formato das teclas</p>
        <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Formato das teclas">{formas.map((f) => <Chip key={f.id} cheio ativo={t.forma === f.id} onClick={() => mudarTeclado({ forma: f.id })}>{f.nome}</Chip>)}</div>
      </div>
      <div>
        <p className="mb-1 text-xs text-suave">Luzes que correm no teclado</p>
        <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Luzes do teclado">{efeitos.map((f) => <Chip key={f.id} cheio ativo={t.efeito === f.id} onClick={() => mudarTeclado({ efeito: f.id })}>{f.nome}</Chip>)}</div>
      </div>
      <Interruptor ligado={t.vibrar} aoMudar={(x) => mudarTeclado({ vibrar: x })} titulo="Vibrar ao tocar" dica="Uma batidinha leve em cada tecla." />
      <AjusteDoToque />
      <div>
        <p className="mb-1 text-xs text-suave">Altura das teclas</p>
        <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Altura das teclas">
          {(["baixa", "media", "alta"] as const).map((a) => <Chip key={a} cheio ativo={t.altura === a} onClick={() => mudarTeclado({ altura: a })}>{a === "baixa" ? "Baixa" : a === "media" ? "Média" : "Alta"}</Chip>)}
        </div>
      </div>
      <div>
        <p className="mb-1 text-xs text-suave">Teste aqui</p>
        <div className="overflow-hidden rounded-xl border border-borda">
          <div className="min-h-10 break-words bg-fundo px-3 py-2 text-sm">{prova || <span className="text-suave">Toque nas teclas…</span>}</div>
          <Teclado aoInserir={(x) => setProva((p) => (p + x).slice(0, 120))} aoApagar={() => setProva((p) => Array.from(p).slice(0, -1).join(""))} aoEnviar={() => setProva("")} inicioDeFrase={prova.trim() === ""} podeEnviar={prova.length > 0} />
        </div>
      </div>
    </div>
  );
}

/** Tela cheia e de tamanho fixo: trocar de aba só muda o conteúdo, nunca o tamanho da tela. */
export function Personalizar({ fechar, irParaInicio }: { fechar: () => void; irParaInicio: () => void }) {
  const [aba, setAba] = useState<Aba>("cores");
  const [confirmar, setConfirmar] = useState(false);
  return (
    <div className="fixed inset-0 z-20 flex flex-col bg-fundo" role="dialog" aria-label="Personalizar o Voxix" onClick={(e) => e.stopPropagation()}>
      <header className="flex flex-none items-center gap-2 border-b border-borda bg-painel px-3 py-2">
        <button onClick={fechar} aria-label="Voltar aos ajustes" className="rounded-xl border border-borda px-3 py-2 text-sm"><span className="inline-flex items-center gap-1"><Icone nome="voltar" tam={16} /> Voltar</span></button>
        <h2 className="min-w-0 flex-1 truncate text-center text-lg font-extrabold">Personalizar</h2>
        <button onClick={irParaInicio} aria-label="Ir para o início" className="rounded-xl bg-neon px-3 py-2 text-sm font-bold text-white"><span className="inline-flex items-center gap-1.5"><Icone nome="inicio" tam={16} /> Início</span></button>
      </header>
      <div className="flex flex-none justify-center bg-painel/60 py-3"><Logo tam={56} /></div>
      <nav className="grid flex-none grid-cols-6 gap-1 border-b border-borda bg-painel px-2 pb-2" role="tablist" aria-label="Seções">
        {ABAS.map((a) => (
          <button key={a.id} type="button" role="tab" aria-selected={aba === a.id} onClick={() => setAba(a.id)}
            className={`flex flex-col items-center gap-0.5 rounded-xl border px-0.5 py-1.5 text-[11px] ${aba === a.id ? "border-neon bg-neon/15 font-bold text-texto" : "border-transparent text-suave"}`}>
            <Icone nome={a.icone} tam={22} />{a.nome}
          </button>
        ))}
      </nav>
      <div className="rolagem min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-xl px-4 py-4">
          {aba === "cores" && <AbaCores />}
          {aba === "formato" && <AbaFormato />}
          {aba === "icones" && <AbaIcones />}
          {aba === "fundo" && <AbaFundo />}
          {aba === "emojis" && <AbaEmojis />}
          {aba === "teclado" && <AbaTeclado />}
          <div className="mt-6 border-t border-borda pt-3">
            {confirmar ? (
              <div className="flex items-center gap-2 text-sm">
                <span className="flex-1">Voltar tudo ao padrão do Voxix?</span>
                <button onClick={() => { restaurarVisual(); guardarFoto("inicio", null); guardarFoto("conversa", null); setConfirmar(false); }} className="rounded-xl bg-erro px-3 py-1.5 font-bold text-[#2a0606]">Voltar</button>
                <button onClick={() => setConfirmar(false)} className="rounded-xl border border-borda px-3 py-1.5">Não</button>
              </div>
            ) : <button onClick={() => setConfirmar(true)} className="min-h-10 px-2 text-sm text-suave underline">Restaurar o padrão</button>}
          </div>
        </div>
      </div>
    </div>
  );
}

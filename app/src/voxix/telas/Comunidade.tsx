import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { api, ErroApi, linkDoConvite, type ComunidadeDetalhe, type Membro } from "../api";
import { useVoxix } from "../estado";
import { Icone } from "../icones";
import { PapelDeParede } from "../papel";
import { Janela } from "./Comunidades";
import type { ItemMenu } from "./ChatBase";
import { Sala } from "./Sala";

const mensagemDe = (e: unknown, padrao: string): string => (e instanceof ErroApi ? e.message : padrao);

async function copiar(texto: string): Promise<boolean> {
  try { await navigator.clipboard.writeText(texto); return true; } catch { return false; }
}

/** Uma comunidade aberta: as salas (abas em cima) e, embaixo, a sala escolhida. */
export function Comunidade({ id, aoVoltar, aoMudou, aoSumir }: { id: string; aoVoltar: () => void; aoMudou: () => void; aoSumir: () => void }) {
  const { sessao } = useVoxix();
  const [c, setC] = useState<ComunidadeDetalhe | null>(null);
  const [sala, setSala] = useState<string | null>(null);
  const [janela, setJanela] = useState<"convite" | "membros" | "sala" | "apagar" | "sair" | null>(null);
  const [erro, setErro] = useState("");
  const token = sessao?.token;
  const fora = useRef({ aoMudou, aoSumir });
  fora.current = { aoMudou, aoSumir };

  const carregar = useCallback(async () => {
    if (!token) return;
    try {
      const d = await api.comunidade(token, id);
      setC(d);
      setSala((s) => (s && d.salas.some((x) => x.id === s) ? s : d.salas[0]?.id ?? null));
    } catch (e) {
      if (e instanceof ErroApi && (e.status === 403 || e.status === 404)) { fora.current.aoMudou(); fora.current.aoSumir(); } else setErro(mensagemDe(e, "Não consegui abrir a comunidade."));
    }
  }, [token, id]);
  useEffect(() => { setC(null); setSala(null); setErro(""); void carregar(); }, [carregar]);

  if (!c) return <div className="relative z-[1] m-auto text-sm text-suave">{erro || "Abrindo…"}</div>;
  const dono = c.cargo === "dono";
  const salaAtual = c.salas.find((s) => s.id === sala) ?? c.salas[0];
  const menu: ItemMenu[] = [
    { rotulo: "Convidar pessoas", aoTocar: () => setJanela("convite") },
    { rotulo: "Membros", aoTocar: () => setJanela("membros") },
    ...(dono ? [{ rotulo: "Nova sala", aoTocar: () => setJanela("sala") }, ...(c.salas.length > 1 && salaAtual ? [{ rotulo: `Apagar a sala #${salaAtual.nome}`, perigo: true, aoTocar: () => void apagarSala(salaAtual.id) }] : []), { rotulo: "Apagar comunidade", perigo: true, aoTocar: () => setJanela("apagar") }]
      : [{ rotulo: "Sair da comunidade", perigo: true, aoTocar: () => setJanela("sair") }]),
  ];
  async function apagarSala(sid: string) {
    if (!token) return;
    try { await api.apagarSala(token, id, sid); await carregar(); } catch (e) { setErro(mensagemDe(e, "Não consegui apagar a sala.")); }
  }

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <div className="flex items-center gap-1.5 overflow-x-auto border-b border-borda bg-painel px-3 py-2 rolagem" role="tablist" aria-label={`Salas de ${c.nome}`}>
        <span className="flex-none text-sm font-extrabold">{c.nome}</span>
        {c.salas.map((s) => (
          <button key={s.id} role="tab" aria-selected={s.id === salaAtual?.id} onClick={() => setSala(s.id)} className={`flex flex-none items-center gap-1 rounded-full border px-3 py-1 text-sm ${s.id === salaAtual?.id ? "border-neon bg-neon/15 font-bold text-neon" : "border-borda text-suave"}`}><Icone nome="hash" tam={14} />{s.nome}</button>
        ))}
      </div>
      {erro && <p className="px-4 py-1 text-xs text-aviso" role="status">{erro}</p>}
      <div className="relative flex min-h-0 flex-1 flex-col"><PapelDeParede qual="conversa" />
        {salaAtual && <div className="relative z-[1] flex min-h-0 flex-1 flex-col"><Sala key={salaAtual.id} comunidade={c.nome} icone={c.icone} sala={salaAtual} menu={menu} aoVoltar={aoVoltar} aoPerder={() => void carregar()} /></div>}
      </div>
      {janela === "convite" && <Convite c={c} fechar={() => setJanela(null)} aoTrocar={(codigo) => setC({ ...c, codigo })} />}
      {janela === "membros" && <Membros c={c} fechar={() => setJanela(null)} />}
      {janela === "sala" && <NovaSala id={id} fechar={() => setJanela(null)} aoCriar={async (sid) => { setJanela(null); await carregar(); setSala(sid); }} />}
      {(janela === "apagar" || janela === "sair") && (
        <Janela titulo={janela === "apagar" ? "Apagar comunidade?" : "Sair da comunidade?"} fechar={() => setJanela(null)}>
          <p className="text-sm text-suave">{janela === "apagar" ? `“${c.nome}”, as salas e os convites deixam de existir para todo mundo.` : `Você deixa “${c.nome}”. Para voltar, precisa de um convite (ou entrar de novo, se for pública).`}</p>
          <div className="flex gap-2">
            <button onClick={() => setJanela(null)} className="flex-1 rounded-xl border border-borda py-2.5">Cancelar</button>
            <button onClick={async () => { if (!token) return; try { await (janela === "apagar" ? api.apagarComunidade(token, id) : api.sairDaComunidade(token, id)); aoMudou(); aoSumir(); } catch (e) { setErro(mensagemDe(e, "Não consegui agora.")); setJanela(null); } }} className="flex-1 rounded-xl bg-erro py-2.5 font-extrabold text-[#2a0606]">{janela === "apagar" ? "Apagar" : "Sair"}</button>
          </div>
        </Janela>
      )}
    </div>
  );
}

function Convite({ c, fechar, aoTrocar }: { c: ComunidadeDetalhe; fechar: () => void; aoTrocar: (codigo: string) => void }) {
  const { sessao } = useVoxix();
  const [aviso, setAviso] = useState("");
  const dono = c.cargo === "dono";
  const link = c.codigo ? linkDoConvite(c.codigo) : "";
  const cp = async (t: string, o: string) => setAviso((await copiar(t)) ? `${o} copiado.` : "Não consegui copiar. Segure o texto para copiar.");
  const trocar = async () => { if (!sessao) return; try { aoTrocar((await api.trocarCodigo(sessao.token, c.id)).codigo); setAviso("Código novo! O antigo não vale mais."); } catch (e) { setAviso(mensagemDe(e, "Não consegui trocar agora.")); } };
  return (
    <Janela titulo="Convidar pessoas" fechar={fechar}>
      {!dono || !c.codigo ? <p className="text-sm text-suave">Só o dono da comunidade pode gerar convites. Peça o link ou o código a ele.</p> : (
        <>
          <p className="text-sm text-suave">Mande o link ou o código. Quem receber cola em <b>Comunidades › Entrar</b>.{c.publica ? " Como ela é pública, também aparece em Explorar." : ""}</p>
          <div className="rounded-xl border border-borda bg-fundo p-3 text-center"><div className="text-xs text-suave">Código</div><div className="text-2xl font-extrabold tracking-[0.3em]">{c.codigo}</div></div>
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => void cp(link, "Link")} className="flex items-center justify-center gap-1.5 rounded-xl bg-neon py-2.5 font-extrabold text-white"><Icone nome="link" tam={18} />Copiar link</button>
            <button onClick={() => void cp(c.codigo!, "Código")} className="flex items-center justify-center gap-1.5 rounded-xl border border-borda py-2.5 font-bold"><Icone nome="copiar" tam={18} />Copiar código</button>
          </div>
          <button onClick={() => void trocar()} className="w-full text-center text-sm text-suave underline">Trocar o código (o antigo deixa de valer)</button>
        </>
      )}
      {aviso && <p className="text-sm text-aviso" role="status">{aviso}</p>}
    </Janela>
  );
}

function Membros({ c, fechar }: { c: ComunidadeDetalhe; fechar: () => void }) {
  const { sessao, perfil } = useVoxix();
  const [lista, setLista] = useState<Membro[] | null>(null);
  const [erro, setErro] = useState("");
  useEffect(() => { if (sessao) void api.membros(sessao.token, c.id).then((r) => setLista(r.membros)).catch((e) => { setLista([]); setErro(mensagemDe(e, "Não consegui listar.")); }); }, [sessao, c.id]);
  const expulsar = async (a: string) => { if (!sessao) return; try { await api.expulsar(sessao.token, c.id, a); setLista((l) => (l ?? []).filter((m) => m.apelido !== a)); } catch (e) { setErro(mensagemDe(e, "Não consegui remover.")); } };
  return (
    <Janela titulo={`Membros (${c.membros})`} fechar={fechar}>
      {lista === null && <p className="text-sm text-suave">Carregando…</p>}
      {lista?.map((m) => (
        <div key={m.apelido} className="flex items-center gap-3 text-sm">
          <span className="avatar grid h-9 w-9 flex-none place-items-center bg-gradient-to-br from-neon to-magenta font-extrabold text-white">{m.nome.slice(0, 1).toUpperCase()}</span>
          <span className="min-w-0 flex-1"><b className="block truncate">{m.nome}</b><span className="text-xs text-suave">@{m.apelido}{m.cargo === "dono" ? " · dono" : ""}{m.apelido === perfil?.apelido ? " · você" : ""}</span></span>
          {c.cargo === "dono" && m.cargo !== "dono" && <button onClick={() => void expulsar(m.apelido)} className="text-erro underline">Remover</button>}
        </div>
      ))}
      {erro && <p className="text-sm text-erro" role="alert">{erro}</p>}
    </Janela>
  );
}

function NovaSala({ id, fechar, aoCriar }: { id: string; fechar: () => void; aoCriar: (sala: string) => void | Promise<void> }) {
  const { sessao } = useVoxix();
  const [nome, setNome] = useState("");
  const [erro, setErro] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const criar = async (e: FormEvent) => {
    e.preventDefault();
    if (!sessao) return;
    setOcupado(true); setErro("");
    try { await aoCriar((await api.criarSala(sessao.token, id, nome)).id); } catch (er) { setErro(mensagemDe(er, "Não consegui criar a sala.")); setOcupado(false); }
  };
  return (
    <Janela titulo="Nova sala de texto" fechar={fechar}>
      <form onSubmit={(e) => void criar(e)} className="space-y-3">
        <div className="flex items-center rounded-xl border border-borda bg-fundo px-4 focus-within:border-neon"><span className="text-suave"><Icone nome="hash" tam={18} /></span><input autoFocus value={nome} onChange={(e) => setNome(e.target.value)} maxLength={30} placeholder="nome-da-sala" autoCapitalize="none" autoCorrect="off" className="w-full bg-transparent px-2 py-3 outline-none" /></div>
        {erro && <p className="text-sm text-erro" role="alert">{erro}</p>}
        <div className="flex gap-2"><button type="button" onClick={fechar} className="flex-1 rounded-xl border border-borda py-2.5">Cancelar</button><button disabled={ocupado || nome.trim().length < 2} className="flex-1 rounded-xl bg-neon py-2.5 font-extrabold text-white disabled:opacity-60">{ocupado ? "Criando…" : "Criar"}</button></div>
      </form>
    </Janela>
  );
}

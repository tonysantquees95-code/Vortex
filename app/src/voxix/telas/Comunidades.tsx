import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from "react";
import { api, ErroApi, type Comunidade, type ComunidadeDetalhe } from "../api";
import { useVoxix } from "../estado";
import { Icone, type NomeIcone } from "../icones";

export const ICONES_COMUNIDADE: NomeIcone[] = ["grupo", "jogo", "estrela", "raio", "coracao", "escudo", "chama", "planeta"];
const icone = (n: string): NomeIcone => (ICONES_COMUNIDADE as string[]).includes(n) ? (n as NomeIcone) : "grupo";

export function AvatarComunidade({ nome, tam = 44 }: { nome: string; tam?: number }) {
  return <span className="avatar grid flex-none place-items-center bg-gradient-to-br from-neon to-magenta text-white" style={{ width: tam, height: tam }}><Icone nome={icone(nome)} tam={Math.round(tam / 2)} /></span>;
}

/** Janela no estilo do app (mesmo formato e cores das outras). */
export function Janela({ titulo, fechar, children }: { titulo: string; fechar: () => void; children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-10 grid place-items-center bg-black/70 p-4" onClick={fechar}>
      <div onClick={(e) => e.stopPropagation()} className="rolagem max-h-[calc(100vh-2rem)] w-full max-w-sm space-y-3 overflow-y-auto rounded-2xl border border-borda bg-painel p-5">
        <div className="flex items-center justify-between"><h2 className="text-lg font-extrabold">{titulo}</h2><button onClick={fechar} aria-label="Fechar" className="grid min-h-10 min-w-10 place-items-center text-suave"><Icone nome="fechar" tam={22} /></button></div>
        {children}
      </div>
    </div>
  );
}

const mensagemDe = (e: unknown, padrao: string): string => (e instanceof ErroApi ? e.message : padrao);

/** Lista das comunidades de quem usa, com os atalhos de criar, entrar e explorar. */
export function ListaComunidades({ atual, aoAbrir, versao }: { atual: string | null; aoAbrir: (id: string) => void; versao: number }) {
  const { sessao } = useVoxix();
  const [lista, setLista] = useState<Comunidade[] | null>(null);
  const [janela, setJanela] = useState<"criar" | "entrar" | null>(null);
  useEffect(() => {
    if (!sessao) return;
    let vivo = true;
    void api.minhasComunidades(sessao.token).then((r) => { if (vivo) setLista(r.comunidades); }).catch(() => { if (vivo) setLista((l) => l ?? []); });
    return () => { vivo = false; };
  }, [sessao, versao]);
  const abrirNova = (c: ComunidadeDetalhe) => { setLista((l) => [c, ...(l ?? []).filter((x) => x.id !== c.id)]); setJanela(null); aoAbrir(c.id); };
  return (
    <>
      <div className="flex gap-2 px-4 pb-2">
        <button onClick={() => setJanela("criar")} className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-neon py-2 text-sm font-extrabold text-white"><Icone nome="adicionar" tam={18} />Criar</button>
        <button onClick={() => setJanela("entrar")} className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-borda py-2 text-sm font-bold"><Icone nome="link" tam={18} />Entrar</button>
      </div>
      {lista === null && <p className="px-6 py-6 text-center text-sm text-suave">Carregando…</p>}
      {lista?.length === 0 && <p className="px-6 py-8 text-center text-sm text-suave">Você ainda não está em nenhuma comunidade. Toque em <b className="text-neon">Criar</b>, ou em <b className="text-neon">Entrar</b> para usar um convite ou explorar as públicas.</p>}
      {lista?.map((c) => (
        <button key={c.id} onClick={() => aoAbrir(c.id)} className={`flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-white/5 ${atual === c.id ? "bg-white/10" : ""}`}>
          <AvatarComunidade nome={c.icone} />
          <span className="min-w-0 flex-1">
            <b className="flex items-center gap-1.5 truncate">{c.nome}{!c.publica && <span className="text-suave"><Icone nome="cadeado" tam={14} /></span>}</b>
            <span className="block truncate text-sm text-suave">{c.membros} {c.membros === 1 ? "membro" : "membros"}{c.cargo === "dono" ? " · você é o dono" : ""}</span>
          </span>
        </button>
      ))}
      {janela === "criar" && <CriarComunidade fechar={() => setJanela(null)} aoCriar={abrirNova} />}
      {janela === "entrar" && <EntrarComunidade fechar={() => setJanela(null)} aoEntrar={abrirNova} />}
    </>
  );
}

function CriarComunidade({ fechar, aoCriar }: { fechar: () => void; aoCriar: (c: ComunidadeDetalhe) => void }) {
  const { sessao } = useVoxix();
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [ic, setIc] = useState<NomeIcone>("jogo");
  const [publica, setPublica] = useState(false);
  const [erro, setErro] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const criar = async (e: FormEvent) => {
    e.preventDefault();
    if (!sessao) return;
    setOcupado(true);
    setErro("");
    try { aoCriar(await api.criarComunidade(sessao.token, { nome, descricao, publica, icone: ic })); } catch (er) { setErro(mensagemDe(er, "Não consegui criar agora.")); } finally { setOcupado(false); }
  };
  return (
    <Janela titulo="Nova comunidade" fechar={fechar}>
      <form onSubmit={(e) => void criar(e)} className="space-y-3">
        <div className="grid grid-cols-4 gap-2" role="radiogroup" aria-label="Ícone da comunidade">
          {ICONES_COMUNIDADE.map((n) => (
            <button type="button" key={n} role="radio" aria-checked={ic === n} aria-label={n} onClick={() => setIc(n)} className={`grid h-12 place-items-center rounded-xl border ${ic === n ? "border-neon bg-neon/15 text-neon" : "border-borda text-suave"}`}><Icone nome={n} tam={24} /></button>
          ))}
        </div>
        <input autoFocus value={nome} onChange={(e) => setNome(e.target.value)} maxLength={40} placeholder="Nome da comunidade" className="w-full rounded-xl border border-borda bg-fundo px-4 py-3 outline-none focus:border-neon" />
        <input value={descricao} onChange={(e) => setDescricao(e.target.value)} maxLength={200} placeholder="Sobre o que é (opcional)" className="w-full rounded-xl border border-borda bg-fundo px-4 py-3 outline-none focus:border-neon" />
        <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Tipo da comunidade">
          {([[false, "Privada", "cadeado", "Só entra quem recebe o convite."], [true, "Pública", "globo", "Aparece na lista e qualquer um entra."]] as const).map(([v, rot, ico, dica]) => (
            <button type="button" key={rot} role="radio" aria-checked={publica === v} onClick={() => setPublica(v)} className={`rounded-xl border p-3 text-left ${publica === v ? "border-neon bg-neon/15" : "border-borda"}`}>
              <b className="flex items-center gap-1.5"><Icone nome={ico} tam={18} />{rot}</b><span className="mt-1 block text-xs text-suave">{dica}</span>
            </button>
          ))}
        </div>
        {erro && <p className="text-sm text-erro" role="alert">{erro}</p>}
        <div className="flex gap-2">
          <button type="button" onClick={fechar} className="flex-1 rounded-xl border border-borda py-2.5">Cancelar</button>
          <button disabled={ocupado || nome.trim().length < 3} className="flex-1 rounded-xl bg-neon py-2.5 font-extrabold text-white disabled:opacity-60">{ocupado ? "Criando…" : "Criar"}</button>
        </div>
      </form>
    </Janela>
  );
}

function EntrarComunidade({ fechar, aoEntrar }: { fechar: () => void; aoEntrar: (c: ComunidadeDetalhe) => void }) {
  const { sessao } = useVoxix();
  const [aba, setAba] = useState<"convite" | "explorar">("convite");
  const [convite, setConvite] = useState("");
  const [previa, setPrevia] = useState<Comunidade | null>(null);
  const [busca, setBusca] = useState("");
  const [achadas, setAchadas] = useState<Comunidade[] | null>(null);
  const [erro, setErro] = useState("");
  const [ocupado, setOcupado] = useState(false);

  const procurar = useCallback(async (q: string) => {
    if (!sessao) return;
    try { setAchadas((await api.comunidadesPublicas(sessao.token, q)).comunidades); } catch (e) { setAchadas([]); setErro(mensagemDe(e, "Não consegui listar agora.")); }
  }, [sessao]);
  useEffect(() => { if (aba === "explorar") { const t = setTimeout(() => void procurar(busca), 250); return () => clearTimeout(t); } }, [aba, busca, procurar]);

  const ver = async (e: FormEvent) => {
    e.preventDefault();
    if (!sessao) return;
    setOcupado(true); setErro("");
    try { setPrevia(await api.previaDoConvite(sessao.token, convite.trim())); } catch (er) { setErro(mensagemDe(er, "Não consegui conferir o convite.")); } finally { setOcupado(false); }
  };
  const entrar = async (fazer: () => Promise<ComunidadeDetalhe>) => {
    setOcupado(true); setErro("");
    try { aoEntrar(await fazer()); } catch (er) { setErro(mensagemDe(er, "Não consegui entrar agora.")); } finally { setOcupado(false); }
  };
  return (
    <Janela titulo="Entrar numa comunidade" fechar={fechar}>
      <div className="grid grid-cols-2 gap-2" role="tablist">
        {([["convite", "Tenho um convite", "link"], ["explorar", "Explorar públicas", "buscar"]] as const).map(([id, rot, ico]) => (
          <button key={id} role="tab" aria-selected={aba === id} onClick={() => { setAba(id); setErro(""); }} className={`flex items-center justify-center gap-1.5 rounded-xl border py-2 text-sm font-bold ${aba === id ? "border-neon bg-neon/15 text-neon" : "border-borda text-suave"}`}><Icone nome={ico} tam={16} />{rot}</button>
        ))}
      </div>
      {aba === "convite" && !previa && (
        <form onSubmit={(e) => void ver(e)} className="space-y-3">
          <p className="text-sm text-suave">Cole o link do convite ou digite o código (8 letras e números).</p>
          <input autoFocus value={convite} onChange={(e) => setConvite(e.target.value)} placeholder="Link ou código" autoCapitalize="none" autoCorrect="off" className="w-full rounded-xl border border-borda bg-fundo px-4 py-3 outline-none focus:border-neon" />
          <button disabled={ocupado || convite.trim().length < 8} className="w-full rounded-xl bg-neon py-2.5 font-extrabold text-white disabled:opacity-60">{ocupado ? "Conferindo…" : "Continuar"}</button>
        </form>
      )}
      {aba === "convite" && previa && (
        <div className="space-y-3 text-center">
          <AvatarComunidade nome={previa.icone} tam={64} />
          <div><b className="text-lg">{previa.nome}</b>{previa.descricao && <p className="text-sm text-suave">{previa.descricao}</p>}<p className="mt-1 text-xs text-suave">{previa.membros} {previa.membros === 1 ? "membro" : "membros"}</p></div>
          <div className="flex gap-2">
            <button onClick={() => setPrevia(null)} className="flex-1 rounded-xl border border-borda py-2.5">Voltar</button>
            <button disabled={ocupado || !sessao} onClick={() => sessao && void entrar(() => api.entrarPorConvite(sessao.token, convite.trim()))} className="flex-1 rounded-xl bg-neon py-2.5 font-extrabold text-white disabled:opacity-60">{ocupado ? "Entrando…" : "Entrar"}</button>
          </div>
        </div>
      )}
      {aba === "explorar" && (
        <div className="space-y-2">
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar pelo nome" className="w-full rounded-xl border border-borda bg-fundo px-4 py-3 outline-none focus:border-neon" />
          {achadas === null && <p className="py-3 text-center text-sm text-suave">Procurando…</p>}
          {achadas?.length === 0 && <p className="py-3 text-center text-sm text-suave">Nenhuma comunidade pública encontrada.</p>}
          {achadas?.map((c) => (
            <div key={c.id} className="flex items-center gap-3 rounded-xl border border-borda p-2.5">
              <AvatarComunidade nome={c.icone} tam={40} />
              <span className="min-w-0 flex-1"><b className="block truncate">{c.nome}</b><span className="block truncate text-xs text-suave">{c.membros} {c.membros === 1 ? "membro" : "membros"}{c.descricao ? ` · ${c.descricao}` : ""}</span></span>
              <button disabled={ocupado || !sessao} onClick={() => sessao && void entrar(() => api.entrarNaPublica(sessao.token, c.id))} className="rounded-xl bg-neon px-3 py-1.5 text-sm font-extrabold text-white disabled:opacity-60">Entrar</button>
            </div>
          ))}
        </div>
      )}
      {erro && <p className="text-sm text-erro" role="alert">{erro}</p>}
    </Janela>
  );
}

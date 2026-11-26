// Estado do app: sessão, perfil, conversas (guardadas no aparelho) e a conexão ao vivo com o servidor.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { api, enderecoWs, ErroApi, type MensagemDoServidor, type Pessoa } from "./api";
import * as A from "./armazem";
import { avisar, naTela } from "./avisos";
import { atualizarAvatares, definirAvatarLocal } from "./avatares";
import { entrar as entrarNaConta, guardarSessao, sair as sairDaConta, sessaoGuardada, sessaoMorta, type Sessao } from "./conta";

const CHAVE_CONVERSAS = "voxix.conversas";

function lerGuardado(): A.Armazem {
  try { return A.ler(JSON.parse(localStorage.getItem(CHAVE_CONVERSAS) ?? "null")); } catch { return A.vazio(); }
}
function gravar(a: A.Armazem): void {
  try { localStorage.setItem(CHAVE_CONVERSAS, JSON.stringify(a)); } catch { /* sem espaço ou sem armazenamento */ }
}

export type Conexao = "conectado" | "conectando" | "offline";
interface Valor {
  sessao: Sessao | null;
  perfil: Pessoa | null | undefined; // undefined = ainda conferindo; null = precisa criar
  armazem: A.Armazem;
  conexao: Conexao;
  aberta: string | null;
  entrar: (email: string, senha: string) => Promise<void>;
  sair: () => Promise<void>;
  criarPerfil: (apelido: string, nome: string) => Promise<void>;
  mudarAvatar: (avatar: string | null) => Promise<void>;
  abrir: (apelido: string | null) => void;
  novaConversa: (apelido: string) => Promise<Pessoa>;
  enviar: (apelido: string, texto: string) => Promise<void>;
  reenviar: (apelido: string, id: string, texto: string) => Promise<void>;
  apagar: (apelido: string) => void;
}
const Contexto = createContext<Valor | null>(null);
export const useVoxix = (): Valor => {
  const v = useContext(Contexto);
  if (!v) throw new Error("useVoxix fora do provedor");
  return v;
};

const novoIdLocal = () => `l${Date.now().toString(36)}${Array.from(crypto.getRandomValues(new Uint8Array(3)), (b) => b.toString(16).padStart(2, "0")).join("")}`;

export function ProvedorDoVoxix({ children }: { children: ReactNode }) {
  const [sessao, setSessao] = useState<Sessao | null>(sessaoGuardada);
  const [perfil, setPerfil] = useState<Pessoa | null | undefined>(undefined);
  const [armazem, setArmazem] = useState<A.Armazem>(lerGuardado);
  const [conexao, setConexao] = useState<Conexao>("offline");
  const [aberta, setAberta] = useState<string | null>(null);
  const arm = useRef(armazem);
  const abertaRef = useRef<string | null>(null);

  const atualizar = useCallback((f: (a: A.Armazem) => A.Armazem) => {
    arm.current = f(arm.current);
    gravar(arm.current); // grava antes de confirmar o recebimento ao servidor
    setArmazem(arm.current);
  }, []);

  const sairLocal = useCallback(() => { guardarSessao(null); setSessao(null); setPerfil(undefined); setAberta(null); abertaRef.current = null; }, []);

  // confere o perfil assim que há sessão
  useEffect(() => {
    if (!sessao) return;
    let vivo = true;
    api.perfil(sessao.token)
      .then((p) => { if (vivo) setPerfil(p.apelido ? { apelido: p.apelido, nome: p.nome ?? p.apelido, avatar: p.avatar ?? null } : null); if (vivo && p.apelido) definirAvatarLocal(p.apelido, p.avatar ?? null); })
      .catch((e) => { if (sessaoMorta(e)) sairLocal(); else if (vivo) setPerfil((x) => x ?? undefined); });
    return () => { vivo = false; };
  }, [sessao, sairLocal]);

  // conexão ao vivo (com religação automática)
  useEffect(() => {
    if (!sessao || !perfil) return;
    let ws: WebSocket | null = null;
    let parar = false;
    let tentativa = 0;
    let religar: ReturnType<typeof setTimeout> | undefined;
    let batida: ReturnType<typeof setInterval> | undefined;

    const receberLote = (lista: MensagemDoServidor[]) => {
      if (!lista.length) return;
      for (const m of lista) {
        const novo = !A.temMensagem(arm.current, m.id);
        atualizar((a) => A.receber(a, m.de, m.deNome, m.id, m.corpo, m.criado, abertaRef.current === m.de.toLowerCase()));
        if (novo) avisarChegada(m.de, m.deNome, m.corpo, m.criado);
      }
      if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ t: "ack", ids: lista.map((m) => m.id) }));
    };
    // aviso do sistema para mensagem nova (só quando a conversa não está na tela e a mensagem é recente: não avisa o histórico antigo)
    const avisarChegada = (apelido: string, nome: string, corpo: string, criado: number) => {
      if (Date.now() - criado > 120_000) return;
      if (naTela(abertaRef.current === apelido.toLowerCase())) return;
      void avisar(nome || apelido, corpo, `dm-${apelido.toLowerCase()}`);
    };
    // histórico no servidor: traz o que foi escrito em outros aparelhos (e tudo, ao entrar num aparelho novo)
    const sincronizarHistorico = async () => {
      const chaveMarca = `voxix.hist.${sessao.email}`;
      let marca = 0;
      try { marca = Number(localStorage.getItem(chaveMarca)) || 0; } catch { /* sem armazenamento: busca tudo */ }
      if (Object.keys(arm.current.conversas).length === 0) marca = 0; // armazenamento do aparelho vazio: busca tudo de novo
      const primeira = marca === 0;
      for (let volta = 0; volta < 40 && !parar; volta++) {
        const r = await api.historico(sessao.token, marca);
        if (parar || r.mensagens.length === 0) break;
        const novas = r.mensagens.filter((m) => !A.temMensagem(arm.current, m.id));
        atualizar((a) => { const b = A.mesclarHistorico(a, r.mensagens, !primeira); return abertaRef.current ? A.marcarLida(b, abertaRef.current) : b; });
        if (!primeira) for (const m of novas) if (!m.minha) avisarChegada(m.apelido, m.nome, m.corpo, m.criado);
        marca = r.mensagens[r.mensagens.length - 1]!.criado;
        try { localStorage.setItem(chaveMarca, String(marca)); } catch { /* ok */ }
        if (!r.mais) break;
      }
    };
    const conectar = async () => {
      if (parar) return;
      setConexao("conectando");
      const url = await enderecoWs(sessao.token);
      if (parar) return;
      ws = new WebSocket(url);
      ws.onopen = () => { tentativa = 0; setConexao("conectado"); void sincronizarHistorico().catch((er) => { if (sessaoMorta(er)) sairLocal(); }); clearInterval(batida); batida = setInterval(() => { if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ t: "ping" })); }, 25000); };
      ws.onmessage = (e) => {
        try {
          const d = JSON.parse(String(e.data)) as { t: string; mensagens?: MensagemDoServidor[]; mensagem?: MensagemDoServidor };
          if (d.t === "fila" && d.mensagens) receberLote(d.mensagens);
          else if (d.t === "msg" && d.mensagem) receberLote([d.mensagem]);
        } catch { /* mensagem estranha: ignora */ }
      };
      ws.onclose = () => {
        clearInterval(batida);
        if (parar) return;
        setConexao("offline");
        tentativa++;
        if (tentativa % 3 === 0) api.perfil(sessao.token).catch((er) => { if (sessaoMorta(er)) sairLocal(); });
        religar = setTimeout(() => void conectar(), Math.min(15000, 1000 * 2 ** Math.min(tentativa, 4)));
      };
      ws.onerror = () => { try { ws?.close(); } catch { /* ok */ } };
    };
    const voltou = () => { if (document.visibilityState === "visible" && (!ws || ws.readyState === WebSocket.CLOSED)) { clearTimeout(religar); void conectar(); } };
    document.addEventListener("visibilitychange", voltou);
    void conectar();
    return () => { parar = true; clearTimeout(religar); clearInterval(batida); document.removeEventListener("visibilitychange", voltou); try { ws?.close(); } catch { /* ok */ } setConexao("offline"); };
  }, [sessao, perfil, atualizar, sairLocal]);

  const entrar = useCallback(async (email: string, senha: string) => {
    const s = await entrarNaConta(email, senha);
    guardarSessao(s);
    setPerfil(undefined);
    setSessao(s);
  }, []);
  const sair = useCallback(async () => { if (sessao) await sairDaConta(sessao.token); sairLocal(); }, [sessao, sairLocal]);
  const criarPerfil = useCallback(async (apelido: string, nome: string) => {
    if (!sessao) return;
    setPerfil(await api.criarPerfil(sessao.token, apelido, nome));
  }, [sessao]);
  const mudarAvatar = useCallback(async (avatar: string | null) => {
    if (!sessao || !perfil) return;
    const r = await api.definirAvatar(sessao.token, avatar);
    definirAvatarLocal(perfil.apelido, r.avatar);
    setPerfil((p) => (p ? { ...p, avatar: r.avatar } : p));
  }, [sessao, perfil]);
  const abrir = useCallback((apelido: string | null) => {
    const k = apelido ? apelido.toLowerCase() : null;
    abertaRef.current = k;
    setAberta(k);
    if (k) atualizar((a) => A.marcarLida(a, k));
  }, [atualizar]);
  const novaConversa = useCallback(async (apelido: string) => {
    if (!sessao) throw new ErroApi("Entre primeiro.");
    const p = await api.buscar(sessao.token, apelido.trim().toLowerCase());
    atualizar((a) => A.garantir(a, p.apelido, p.nome));
    return p;
  }, [sessao, atualizar]);

  const mandar = useCallback(async (apelido: string, idLocal: string, texto: string) => {
    if (!sessao) return;
    try {
      const r = await api.enviar(sessao.token, apelido, texto, idLocal);
      atualizar((a) => A.confirmar(a, apelido, idLocal, r.id, r.criado));
    } catch (e) {
      atualizar((a) => A.falhou(a, apelido, idLocal));
      if (sessaoMorta(e)) sairLocal();
      throw e;
    }
  }, [sessao, atualizar, sairLocal]);
  const enviar = useCallback(async (apelido: string, texto: string) => {
    const idLocal = novoIdLocal();
    const nome = arm.current.conversas[apelido.toLowerCase()]?.nome ?? apelido;
    atualizar((a) => A.enviando(a, apelido, nome, idLocal, texto, Date.now()));
    await mandar(apelido, idLocal, texto);
  }, [atualizar, mandar]);
  const reenviar = useCallback(async (apelido: string, id: string, texto: string) => {
    atualizar((a) => A.tentando(a, apelido, id));
    await mandar(apelido, id, texto);
  }, [atualizar, mandar]);
  const apagar = useCallback((apelido: string) => { if (sessao) void api.limparConversa(sessao.token, apelido).catch(() => undefined); atualizar((a) => A.apagarConversa(a, apelido)); if (abertaRef.current === apelido.toLowerCase()) abrir(null); }, [sessao, atualizar, abrir]);

  // pega as fotinhas de quem está nas conversas (guarda um tempo no aparelho)
  const chaveConversas = Object.keys(armazem.conversas).sort().join(",");
  useEffect(() => {
    if (sessao && chaveConversas) void atualizarAvatares(sessao.token, chaveConversas.split(","));
  }, [sessao, chaveConversas]);

  useEffect(() => {
    const n = A.totalNaoLidas(armazem);
    document.title = n > 0 ? `(${n}) Voxix` : "Voxix";
  }, [armazem]);

  const valor = useMemo<Valor>(() => ({ sessao, perfil, armazem, conexao, aberta, entrar, sair, criarPerfil, mudarAvatar, abrir, novaConversa, enviar, reenviar, apagar }), [sessao, perfil, armazem, conexao, aberta, entrar, sair, criarPerfil, mudarAvatar, abrir, novaConversa, enviar, reenviar, apagar]);
  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

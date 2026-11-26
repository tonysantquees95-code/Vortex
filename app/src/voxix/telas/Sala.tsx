import { useCallback, useEffect, useRef, useState } from "react";
import { enderecoDaSala, type Pessoa } from "../api";
import { useVoxix } from "../estado";
import { Icone } from "../icones";
import { ChatBase, type ItemMenu, type MsgChat } from "./ChatBase";
import { AvatarComunidade } from "./Comunidades";

interface DoServidor { id: string; de: string; deNome: string; corpo: string; criado: number }
type Recebido =
  | { t: "inicio"; mensagens: DoServidor[]; online: Pessoa[] }
  | { t: "msg"; mensagem: DoServidor }
  | { t: "confirmada"; idLocal?: string; mensagem: DoServidor }
  | { t: "recusada"; idLocal?: string; erro: string }
  | { t: "entrou" | "saiu"; pessoa: Pessoa }
  | { t: "removido" | "encerrada" | "pong" };

const novoId = () => `l${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

/** Sala de texto ao vivo: mensagens na hora e lista de quem está online. O servidor só guarda as últimas mensagens. */
export function Sala({ comunidade, icone, sala, menu, aoVoltar, aoPerder }: { comunidade: string; icone: string; sala: { id: string; nome: string }; menu: ItemMenu[]; aoVoltar: () => void; aoPerder: () => void }) {
  const { sessao, perfil } = useVoxix();
  const [mensagens, setMensagens] = useState<MsgChat[]>([]);
  const [online, setOnline] = useState<Pessoa[]>([]);
  const [estado, setEstado] = useState<"conectando" | "ao vivo" | "sem conexão">("conectando");
  const [lista, setLista] = useState(false);
  const ws = useRef<WebSocket | null>(null);
  const perder = useRef(aoPerder);
  perder.current = aoPerder;
  const eu = perfil?.apelido ?? "";
  const token = sessao?.token;

  useEffect(() => {
    if (!token) return;
    setMensagens([]); setOnline([]); setEstado("conectando");
    let parar = false;
    let tentativa = 0;
    let religar: ReturnType<typeof setTimeout> | undefined;
    let batida: ReturnType<typeof setInterval> | undefined;
    const virar = (m: DoServidor): MsgChat => ({ id: m.id, minha: m.de === eu, corpo: m.corpo, criado: m.criado, estado: "enviada", autor: m.de });
    const juntar = (a: MsgChat[], novas: MsgChat[]) => { const ids = new Set(a.map((m) => m.id)); return [...a, ...novas.filter((m) => !ids.has(m.id))].sort((x, y) => x.criado - y.criado); };
    const conectar = async () => {
      if (parar) return;
      setEstado("conectando");
      const url = await enderecoDaSala(token, sala.id);
      if (parar) return;
      const w = new WebSocket(url);
      ws.current = w;
      w.onopen = () => { tentativa = 0; setEstado("ao vivo"); clearInterval(batida); batida = setInterval(() => { if (w.readyState === WebSocket.OPEN) w.send(JSON.stringify({ t: "ping" })); }, 25000); };
      w.onmessage = (e) => {
        let d: Recebido;
        try { d = JSON.parse(String(e.data)) as Recebido; } catch { return; }
        if (d.t === "inicio") { setOnline(d.online); setMensagens((a) => juntar(a.filter((m) => m.estado !== "enviada"), d.mensagens.map(virar))); }
        else if (d.t === "msg") setMensagens((a) => juntar(a, [virar(d.mensagem)]));
        else if (d.t === "confirmada") setMensagens((a) => { const novo = virar(d.mensagem); return juntar(a.filter((m) => m.id !== d.idLocal), [novo]); });
        else if (d.t === "recusada") setMensagens((a) => a.map((m) => (m.id === d.idLocal ? { ...m, estado: "falhou" } : m)));
        else if (d.t === "entrou") setOnline((l) => (l.some((p) => p.apelido === d.pessoa.apelido) ? l : [...l, d.pessoa].sort((a, b) => a.apelido.localeCompare(b.apelido))));
        else if (d.t === "saiu") setOnline((l) => l.filter((p) => p.apelido !== d.pessoa.apelido));
        else if (d.t === "removido" || d.t === "encerrada") { parar = true; perder.current(); }
      };
      w.onclose = () => {
        clearInterval(batida);
        if (parar) return;
        setEstado("sem conexão");
        setMensagens((a) => a.map((m) => (m.estado === "enviando" ? { ...m, estado: "falhou" } : m)));
        tentativa++;
        if (tentativa === 3) perder.current(); // confere se ainda faz parte (a tela pai verifica e, se sim, segue tentando)
        religar = setTimeout(() => void conectar(), Math.min(15000, 1000 * 2 ** Math.min(tentativa, 4)));
      };
      w.onerror = () => { try { w.close(); } catch { /* ok */ } };
    };
    void conectar();
    return () => { parar = true; clearTimeout(religar); clearInterval(batida); try { ws.current?.close(); } catch { /* ok */ } ws.current = null; };
  }, [token, sala.id, eu]);

  const mandar = useCallback((id: string, corpo: string) => {
    const w = ws.current;
    if (!w || w.readyState !== WebSocket.OPEN) { setMensagens((a) => a.map((m) => (m.id === id ? { ...m, estado: "falhou" } : m))); return; }
    w.send(JSON.stringify({ t: "msg", corpo, idLocal: id }));
  }, []);
  const enviar = useCallback(async (texto: string) => {
    const id = novoId();
    setMensagens((a) => [...a, { id, minha: true, corpo: texto, criado: Date.now(), estado: "enviando", autor: eu }]);
    mandar(id, texto);
  }, [eu, mandar]);
  const reenviar = useCallback(async (id: string, corpo: string) => {
    setMensagens((a) => a.map((m) => (m.id === id ? { ...m, estado: "enviando" } : m)));
    mandar(id, corpo);
  }, [mandar]);

  return (
    <ChatBase
      chave={sala.id}
      titulo={`# ${sala.nome}`}
      subtitulo={<><span className={estado === "ao vivo" ? "text-ok" : estado === "conectando" ? "text-aviso" : "text-erro"}>{estado}</span>{estado === "ao vivo" ? ` · ${online.length} online` : ""}</>}
      avatar={<AvatarComunidade nome={icone} tam={40} />}
      aoVoltar={aoVoltar}
      mensagens={mensagens}
      vazio={`Esta é a sala #${sala.nome} de ${comunidade}. Escreva a primeira mensagem!`}
      menu={menu}
      aoEnviar={enviar}
      aoReenviar={reenviar}
      acoes={<button onClick={() => setLista((v) => !v)} aria-label="Quem está online" aria-pressed={lista} className={`flex h-9 items-center gap-1 rounded-full border px-2.5 text-sm ${lista ? "border-neon text-neon" : "border-borda"}`}><Icone nome="grupo" tam={18} />{online.length}</button>}
      cabecalhoExtra={lista && (
        <div className="border-b border-borda bg-painel px-4 py-2 text-sm" aria-label="Quem está online">
          <div className="mb-1 text-xs font-bold text-suave">Online agora ({online.length})</div>
          <div className="flex flex-wrap gap-1.5">
            {online.map((p) => <span key={p.apelido} className="inline-flex items-center gap-1.5 rounded-full border border-borda px-2.5 py-0.5"><span className="h-2 w-2 rounded-full bg-ok" />@{p.apelido}{p.apelido === eu ? " (você)" : ""}</span>)}
            {online.length === 0 && <span className="text-suave">Ninguém por aqui ainda.</span>}
          </div>
        </div>
      )}
    />
  );
}

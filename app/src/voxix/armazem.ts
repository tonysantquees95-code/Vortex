// Histórico das conversas: o servidor guarda tudo (igual em todos os aparelhos da conta); aqui fica a cópia deste aparelho, para abrir rápido e offline.
// Tudo aqui é função pura sobre um objeto simples, para dar para testar sem tela.
export type EstadoMsg = "enviando" | "enviada" | "falhou";
export interface Msg { id: string; minha: boolean; corpo: string; criado: number; estado: EstadoMsg }
export interface Conversa { apelido: string; nome: string; mensagens: Msg[]; naoLidas: number; ultima: number }
export interface Armazem { conversas: Record<string, Conversa> }

export const MAX_POR_CONVERSA = 1000;
export const vazio = (): Armazem => ({ conversas: {} });

const chave = (apelido: string): string => apelido.trim().toLowerCase();

function comMsg(a: Armazem, apelido: string, nome: string, m: Msg, naoLida: boolean): Armazem {
  const k = chave(apelido);
  const atual = a.conversas[k] ?? { apelido: k, nome: nome || k, mensagens: [], naoLidas: 0, ultima: 0 };
  if (atual.mensagens.some((x) => x.id === m.id)) return a; // a mesma mensagem pode chegar duas vezes (fila + ao vivo)
  const mensagens = [...atual.mensagens, m].sort((x, y) => x.criado - y.criado).slice(-MAX_POR_CONVERSA);
  const c: Conversa = { ...atual, nome: nome || atual.nome, mensagens, naoLidas: atual.naoLidas + (naoLida ? 1 : 0), ultima: Math.max(atual.ultima, m.criado) };
  return { conversas: { ...a.conversas, [k]: c } };
}

/** Abre uma conversa vazia (pessoa achada na busca) para poder escrever. */
export function garantir(a: Armazem, apelido: string, nome: string): Armazem {
  const k = chave(apelido);
  if (a.conversas[k]) return a;
  return { conversas: { ...a.conversas, [k]: { apelido: k, nome: nome || k, mensagens: [], naoLidas: 0, ultima: 0 } } };
}

/** Mensagem que chegou de outra pessoa. */
export function receber(a: Armazem, de: string, nome: string, id: string, corpo: string, criado: number, aberta = false): Armazem {
  return comMsg(a, de, nome, { id, minha: false, corpo, criado, estado: "enviada" }, !aberta);
}

/** Mensagem que eu escrevi: aparece na hora como "enviando" até o servidor confirmar. */
export function enviando(a: Armazem, para: string, nome: string, idLocal: string, corpo: string, agora: number): Armazem {
  return comMsg(a, para, nome, { id: idLocal, minha: true, corpo, criado: agora, estado: "enviando" }, false);
}

function trocar(a: Armazem, apelido: string, id: string, f: (m: Msg) => Msg): Armazem {
  const k = chave(apelido);
  const c = a.conversas[k];
  if (!c) return a;
  return { conversas: { ...a.conversas, [k]: { ...c, mensagens: c.mensagens.map((m) => (m.id === id ? f(m) : m)) } } };
}
export function confirmar(a: Armazem, apelido: string, idLocal: string, idServidor: string, criado: number): Armazem {
  const r = trocar(a, apelido, idLocal, (m) => ({ ...m, id: idServidor, criado, estado: "enviada" }));
  const c = r.conversas[chave(apelido)];
  if (!c) return r;
  // o histórico do servidor pode ter chegado antes da confirmação: fica uma mensagem só
  const vistos = new Set<string>();
  const mensagens = c.mensagens.filter((m) => (vistos.has(m.id) ? false : (vistos.add(m.id), true)));
  return mensagens.length === c.mensagens.length ? r : { conversas: { ...r.conversas, [chave(apelido)]: { ...c, mensagens } } };
}
export const falhou = (a: Armazem, apelido: string, idLocal: string): Armazem => trocar(a, apelido, idLocal, (m) => ({ ...m, estado: "falhou" }));
export const tentando = (a: Armazem, apelido: string, id: string): Armazem => trocar(a, apelido, id, (m) => ({ ...m, estado: "enviando" }));

export const temMensagem = (a: Armazem, id: string): boolean => Object.values(a.conversas).some((c) => c.mensagens.some((m) => m.id === id));

export interface ItemHist { id: string; minha: boolean; apelido: string; nome: string; corpo: string; criado: number }
/** Alguém trocou o @: as mensagens antigas (mesmo id) estão numa conversa com o @ velho e as novas chegam no @ novo. Junta tudo na conversa do @ novo. */
export function reagrupar(a: Armazem, itens: { id: string; apelido: string; nome: string }[]): Armazem {
  let r = a;
  for (const i of itens) {
    const novo = chave(i.apelido);
    const velho = Object.keys(r.conversas).find((k) => k !== novo && r.conversas[k].mensagens.some((m) => m.id === i.id));
    if (!velho) continue;
    const v = r.conversas[velho];
    const n = r.conversas[novo] ?? { apelido: novo, nome: i.nome || v.nome, mensagens: [], naoLidas: 0, ultima: 0 };
    const vistos = new Set(n.mensagens.map((m) => m.id));
    const mensagens = [...n.mensagens, ...v.mensagens.filter((m) => !vistos.has(m.id))].sort((x, y) => x.criado - y.criado).slice(-MAX_POR_CONVERSA);
    const { [velho]: _fora, ...resto } = r.conversas;
    r = { conversas: { ...resto, [novo]: { ...n, nome: i.nome || n.nome, mensagens, naoLidas: n.naoLidas + v.naoLidas, ultima: Math.max(n.ultima, v.ultima) } } };
  }
  return r;
}

/** Junta o histórico que veio do servidor com o que já está aqui (sem repetir). `contarNaoLidas`: o que veio de outras pessoas conta como não lido. */
export function mesclarHistorico(a: Armazem, itens: ItemHist[], contarNaoLidas: boolean): Armazem {
  let r = reagrupar(a, itens);
  for (const i of itens) r = comMsg(r, i.apelido, i.nome, { id: i.id, minha: i.minha, corpo: i.corpo, criado: i.criado, estado: "enviada" }, contarNaoLidas && !i.minha);
  return r;
}

export function marcarLida(a: Armazem, apelido: string): Armazem {
  const k = chave(apelido);
  const c = a.conversas[k];
  if (!c || c.naoLidas === 0) return a;
  return { conversas: { ...a.conversas, [k]: { ...c, naoLidas: 0 } } };
}

export function apagarConversa(a: Armazem, apelido: string): Armazem {
  const { [chave(apelido)]: _fora, ...resto } = a.conversas;
  return { conversas: resto };
}

/** Mais recentes primeiro. */
export const lista = (a: Armazem): Conversa[] => Object.values(a.conversas).sort((x, y) => y.ultima - x.ultima);
export const totalNaoLidas = (a: Armazem): number => Object.values(a.conversas).reduce((s, c) => s + c.naoLidas, 0);

/** Lê o que estava guardado, ignorando qualquer coisa fora do formato (arquivo antigo ou mexido). */
export function ler(bruto: unknown): Armazem {
  const saida = vazio();
  if (!bruto || typeof bruto !== "object") return saida;
  const conv = (bruto as { conversas?: unknown }).conversas;
  if (!conv || typeof conv !== "object") return saida;
  for (const [k, c] of Object.entries(conv as Record<string, unknown>)) {
    if (!c || typeof c !== "object") continue;
    const o = c as Record<string, unknown>;
    if (!Array.isArray(o.mensagens) || typeof o.apelido !== "string") continue;
    const mensagens: Msg[] = [];
    for (const m of o.mensagens) {
      const x = m as Record<string, unknown>;
      if (typeof x?.id === "string" && typeof x.corpo === "string" && typeof x.criado === "number") {
        mensagens.push({ id: x.id, minha: x.minha === true, corpo: x.corpo, criado: x.criado, estado: x.estado === "enviando" || x.estado === "falhou" ? (x.estado === "enviando" ? "falhou" : "falhou") : "enviada" });
      }
    }
    saida.conversas[chave(k)] = { apelido: chave(o.apelido), nome: typeof o.nome === "string" ? o.nome : o.apelido, mensagens, naoLidas: Number.isInteger(o.naoLidas) ? Math.max(0, o.naoLidas as number) : 0, ultima: typeof o.ultima === "number" ? o.ultima : 0 };
  }
  return saida;
}

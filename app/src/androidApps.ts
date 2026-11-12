import type { AppAndroid, Jogo } from "./ponte";
import { registrarCapaLocal } from "./capas.ts";

const FAV = "vortex:favoritos-android";
const FALHAS = "vortex:falhas";

const ler = (chave: string): Record<string, number> => { try { return JSON.parse(localStorage.getItem(chave) ?? "{}") as Record<string, number>; } catch { return {}; } };
const gravar = (chave: string, v: Record<string, number>) => { try { localStorage.setItem(chave, JSON.stringify(v)); } catch { /* sem espaço: vale só agora */ } };

export const ehAndroid = (j: Pick<Jogo, "id">) => j.id.startsWith("android:");
export const pacoteDe = (j: Pick<Jogo, "caminho">) => j.caminho;

export function favoritarAndroid(id: string, fav: boolean) {
  const f = ler(FAV);
  if (fav) f[id] = 1; else delete f[id];
  gravar(FAV, f);
}

/** Jogos instalados no aparelho viram itens da biblioteca "Android" (o ícone do app é a capa). */
export function androidParaJogos(apps: AppAndroid[], favoritos: Record<string, number> = ler(FAV)): Jogo[] {
  return apps.map((a) => {
    const id = `android:${a.pacote}`;
    if (a.icone) registrarCapaLocal(id, a.icone);
    return {
      id, titulo: a.nome, plataforma: "android", caminho: a.pacote, bytes: 0, regioes: [], idiomas: [], tags: [], capa: null, capa_online: null,
      descricao: null, desenvolvedor: null, editora: null, ano: null, genero: null, jogadores: null,
      adicionado: 0, favorito: Boolean(favoritos[id]), ultimo_jogo: 0, tempo_total_s: 0, sessoes: 0, disponivel: true,
    };
  }).sort((x, y) => x.titulo.localeCompare(y.titulo, "pt-BR"));
}

/** Conta uma falha ao abrir o jogo; devolve true na segunda seguida (aí o arquivo vai para a pasta Corrompidos). */
export function falhaDeAbertura(id: string): boolean {
  const f = ler(FALHAS);
  f[id] = (f[id] ?? 0) + 1;
  gravar(FALHAS, f);
  return f[id] >= 2;
}
export function limparFalhas(id: string) {
  const f = ler(FALHAS);
  if (id in f) { delete f[id]; gravar(FALHAS, f); }
}

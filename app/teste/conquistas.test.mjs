import test from "node:test";
import assert from "node:assert/strict";
import { conquistasDe, novasConquistas, progressoEscrito, resumir } from "../src/conquistas.ts";

const jogo = (o = {}) => ({ id: "x" + Math.random(), titulo: "J", plataforma: "snes", caminho: "", bytes: 1, regioes: [], idiomas: [], tags: [], capa: null, capa_online: null, descricao: null, desenvolvedor: null, editora: null, ano: null, genero: null, jogadores: null, adicionado: 0, favorito: false, ultimo_jogo: 0, tempo_total_s: 0, sessoes: 0, disponivel: true, ...o });

test("biblioteca vazia: nada cumprido e nada passa da meta", () => {
  const l = conquistasDe([]);
  assert.ok(l.length >= 10);
  assert.ok(l.every((c) => !c.feita && c.atual === 0));
});

test("jogos de Android instalados não contam como coleção nem como tempo", () => {
  const r = resumir([jogo({ plataforma: "android", tempo_total_s: 99999, sessoes: 50 }), jogo()]);
  assert.equal(r.jogos, 1);
  assert.equal(r.sessoes, 0);
  assert.equal(r.horas, 0);
});

test("horas, sessões, consoles e favoritos viram progresso", () => {
  const jogos = [
    jogo({ plataforma: "snes", tempo_total_s: 3600 * 11, sessoes: 6, favorito: true, ano: 1992 }),
    jogo({ plataforma: "gba", tempo_total_s: 3600 * 2, sessoes: 3 }),
    jogo({ plataforma: "nes", tempo_total_s: 1800, sessoes: 1, ano: 1985 }),
  ];
  const por = Object.fromEntries(conquistasDe(jogos).map((c) => [c.id, c]));
  assert.equal(por.primeiro.feita, true);
  assert.equal(por.horas5.feita, true);
  assert.equal(por.horas25.feita, false);
  assert.equal(por.horas25.atual, 13.5);
  assert.equal(por.um10.feita, true);
  assert.equal(por.consoles3.feita, true);
  assert.equal(por.consoles8.feita, false);
  assert.equal(por.classico.feita, true);
  assert.equal(por.fav10.atual, 1);
});

test("o progresso nunca passa da meta e é escrito em português", () => {
  const c = conquistasDe([jogo({ tempo_total_s: 3600 * 500, sessoes: 1000 })]).find((x) => x.id === "horas100");
  assert.equal(c.atual, 100);
  assert.equal(progressoEscrito(c), "100 de 100 horas");
  assert.equal(progressoEscrito({ ...c, atual: 3.5, meta: 5 }), "3,5 de 5 horas");
});

test("na primeira vez nada é novo; depois só o que ainda não foi visto", () => {
  const lista = conquistasDe([jogo({ tempo_total_s: 3600 * 6, sessoes: 2 })]);
  assert.deepEqual(novasConquistas(lista, null), []);
  const novas = novasConquistas(lista, ["primeiro"]).map((c) => c.id);
  assert.ok(novas.includes("horas5"));
  assert.ok(!novas.includes("primeiro"));
});

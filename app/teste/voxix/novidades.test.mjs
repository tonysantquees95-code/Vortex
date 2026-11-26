import test from "node:test";
import assert from "node:assert/strict";
import { NOVIDADES, novasDesde, ultimoId } from "../../src/voxix/novidades.ts";
import { TERMOS, TOUR, VERSAO_DOS_TERMOS } from "../../src/voxix/apresentacao.ts";

test("novidades: ids únicos e crescentes, tipos válidos e textos preenchidos", () => {
  const ids = NOVIDADES.map((n) => n.id);
  assert.equal(new Set(ids).size, ids.length, "id repetido");
  assert.deepEqual(ids, [...ids].sort((a, b) => a - b), "ids fora de ordem: a mais nova vai no fim, com id = maior + 1");
  for (const n of NOVIDADES) {
    assert.ok(["novo", "melhoria", "correcao"].includes(n.tipo), `tipo inválido na novidade ${n.id}`);
    assert.match(n.data, /^\d{4}-\d{2}-\d{2}$/);
    assert.ok(n.titulo.trim().length >= 4 && n.texto.trim().length >= 10, `novidade ${n.id} sem título ou texto`);
  }
});

test("novasDesde mostra só o que a pessoa ainda não viu, da mais nova para a mais antiga", () => {
  const lista = [1, 2, 3, 4].map((id) => ({ id, data: "2026-11-14", tipo: "novo", titulo: `t${id}`, texto: "texto" }));
  assert.deepEqual(novasDesde(2, lista).map((n) => n.id), [4, 3]);
  assert.deepEqual(novasDesde(4, lista), []);
  assert.equal(ultimoId(lista), 4);
  assert.equal(ultimoId([]), 0);
});

test("apresentação: tour e termos completos e sem texto vazio", () => {
  assert.ok(VERSAO_DOS_TERMOS >= 1);
  assert.ok(TOUR.length >= 4 && TERMOS.length >= 5);
  for (const p of TOUR) assert.ok(p.titulo && p.texto && p.icone);
  for (const t of TERMOS) assert.ok(t.titulo && t.texto.length > 30);
});

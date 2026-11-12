import test from "node:test";
import assert from "node:assert/strict";
import { limparOcultos, mudarOculto, mudarJogo, paraOInicio, aplicarFora, OCULTOS_VAZIO } from "../src/ocultos.ts";

test("esconder, tirar e mostrar de novo", () => {
  let o = mudarOculto(OCULTOS_VAZIO, "ps2", "esconder");
  assert.deepEqual(o.esconder, ["ps2"]);
  o = mudarOculto(o, "ps2", "fora");
  assert.deepEqual([o.esconder, o.fora], [[], ["ps2"]]);
  assert.deepEqual(mudarOculto(o, "ps2", "mostrar"), OCULTOS_VAZIO);
});
test("tirar da biblioteca remove os jogos do console", () => {
  const js = [{ plataforma: "ps2" }, { plataforma: "nes" }];
  assert.deepEqual(aplicarFora(js, { ...OCULTOS_VAZIO, fora: ["ps2"] }), [{ plataforma: "nes" }]);
  assert.equal(aplicarFora(js, OCULTOS_VAZIO), js);
});
test("lixo guardado é corrigido", () => {
  assert.deepEqual(limparOcultos({ esconder: [1, "a", "a"], fora: "x" }), { ...OCULTOS_VAZIO, esconder: ["a"] });
  assert.deepEqual(limparOcultos(null), OCULTOS_VAZIO);
});

test("jogo escondido sai do Início mas fica na biblioteca; tirado sai de tudo", () => {
  const js = [{ id: "a", plataforma: "nes" }, { id: "b", plataforma: "nes" }];
  let o = mudarJogo(OCULTOS_VAZIO, "a", "esconder");
  assert.deepEqual(paraOInicio(js, o).map((j) => j.id), ["b"]);
  assert.equal(aplicarFora(js, o).length, 2);
  o = mudarJogo(o, "a", "fora");
  assert.deepEqual(aplicarFora(js, o).map((j) => j.id), ["b"]);
  assert.deepEqual(o.jogosEsconder, []);
  assert.deepEqual(mudarJogo(o, "a", "mostrar"), OCULTOS_VAZIO);
});

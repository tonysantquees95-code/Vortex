import test from "node:test";
import assert from "node:assert/strict";
import { pontuacaoLocal, pareceUmaPergunta } from "../../src/voxix/pontuacao.ts";

test("pontuação rápida: maiúscula no começo e ponto no fim", () => {
  assert.equal(pontuacaoLocal("  a galinha ficou doente  "), "A galinha ficou doente.");
  assert.equal(pontuacaoLocal(""), "");
});

test("pontuação rápida: perguntas ganham interrogação", () => {
  assert.equal(pontuacaoLocal("onde você mora"), "Onde você mora?");
  assert.equal(pontuacaoLocal("por que você não veio"), "Por que você não veio?");
  assert.equal(pontuacaoLocal("você vai hoje"), "Você vai hoje?");
  assert.equal(pareceUmaPergunta("eu vou para casa"), false);
});

test("pontuação rápida: respeita o que já tem pontuação e põe maiúscula depois de ponto", () => {
  assert.equal(pontuacaoLocal("oi! tudo bem?"), "Oi! Tudo bem?");
  assert.equal(pontuacaoLocal("fui lá. depois volto"), "Fui lá. Depois volto.");
});

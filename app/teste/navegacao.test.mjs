import test from "node:test";
import assert from "node:assert/strict";
import { proximoFoco, direcoesDoControle, tempoJogado, iniciais, matizDoTexto } from "../src/navegacao.ts";

const c = (id, x, y) => ({ id, caixa: { x, y, w: 100, h: 100 } });

test("foco vai para o vizinho certo em cada direção", () => {
  const origem = { x: 200, y: 200, w: 100, h: 100 };
  const lista = [c("esq", 50, 200), c("dir", 350, 200), c("cima", 200, 50), c("baixo", 200, 350), c("longe", 900, 200)];
  assert.equal(proximoFoco(origem, lista, "esquerda"), "esq");
  assert.equal(proximoFoco(origem, lista, "direita"), "dir");
  assert.equal(proximoFoco(origem, lista, "cima"), "cima");
  assert.equal(proximoFoco(origem, lista, "baixo"), "baixo");
});

test("prefere o item alinhado ao que está mais perto mas torto; sem vizinho devolve nulo", () => {
  const origem = { x: 0, y: 0, w: 100, h: 100 };
  assert.equal(proximoFoco(origem, [c("torto", 120, 260), c("alinhado", 400, 0)], "direita"), "alinhado");
  assert.equal(proximoFoco(origem, [c("atras", -300, 0)], "direita"), null);
});

test("controle: D-pad e analógico viram direções", () => {
  const b = Array(16).fill(false);
  assert.deepEqual(direcoesDoControle(b, [0, 0]), []);
  b[13] = true;
  assert.deepEqual(direcoesDoControle(b, [0, 0]), ["baixo"]);
  assert.deepEqual(direcoesDoControle(Array(16).fill(false), [0.9, -0.8]), ["cima", "direita"]);
  assert.deepEqual(direcoesDoControle(Array(16).fill(false), [0.2, 0.3]), []);
});

test("tempo jogado e capas sem imagem", () => {
  assert.equal(tempoJogado(0), "—");
  assert.equal(tempoJogado(30), "menos de 1 min");
  assert.equal(tempoJogado(35 * 60), "35 min");
  assert.equal(tempoJogado(7500), "2 h 05 min");
  assert.equal(iniciais("Super Mario World"), "SM");
  assert.equal(iniciais("Zelda"), "ZE");
  assert.equal(matizDoTexto("abc"), matizDoTexto("abc"));
  assert.ok(matizDoTexto("abc") < 360);
});

test("controle genérico: setinha (hat) no eixo 9", async () => {
  const { direcoesDoControle, direcoesDoHat } = await import("../src/navegacao.ts");
  const eixos = (v) => [0, 0, 0, 0, 0, 0, 0, 0, 0, v];
  assert.deepEqual(direcoesDoHat(eixos(1.2857)), []); // solta
  assert.deepEqual(direcoesDoHat(eixos(-1)), ["cima"]);
  assert.deepEqual(direcoesDoHat(eixos(-0.4286)), ["direita"]);
  assert.deepEqual(direcoesDoHat(eixos(0.1429)), ["baixo"]);
  assert.deepEqual(direcoesDoHat(eixos(0.7143)), ["esquerda"]);
  assert.deepEqual(direcoesDoHat([0, 0]), []);
  assert.deepEqual(direcoesDoControle([], eixos(0.1429)), ["baixo"]);
});

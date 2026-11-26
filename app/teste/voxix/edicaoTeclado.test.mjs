import test from "node:test";
import assert from "node:assert/strict";
import { ACENTOS, LETRAS, NUMEROS, apagar, comecaFrase, inserir } from "../../src/voxix/edicaoTeclado.ts";
import { MAX_RECENTES, PACOTES, somarRecente } from "../../src/voxix/emojis.ts";

test("inserir: no cursor, no lugar da seleção e com limites seguros", () => {
  assert.deepEqual(inserir("olá", 3, 3, "!"), { texto: "olá!", pos: 4 });
  assert.deepEqual(inserir("abcd", 1, 3, "X"), { texto: "aXd", pos: 2 });
  assert.deepEqual(inserir("ab", 99, 99, "c"), { texto: "abc", pos: 3 });
  assert.deepEqual(inserir("ab", 0, 0, "😀"), { texto: "😀ab", pos: 2 });
});

test("apagar: seleção, caractere antes do cursor e emoji inteiro", () => {
  assert.deepEqual(apagar("abc", 3, 3), { texto: "ab", pos: 2 });
  assert.deepEqual(apagar("abcd", 1, 3), { texto: "ad", pos: 1 });
  assert.deepEqual(apagar("abc", 0, 0), { texto: "abc", pos: 0 });
  assert.deepEqual(apagar("a😀", 3, 3), { texto: "a", pos: 1 });
  assert.deepEqual(apagar("a😀b", 3, 3), { texto: "ab", pos: 1 });
});

test("comecaFrase: início, depois de ponto e depois de nova linha", () => {
  assert.equal(comecaFrase("", 0), true);
  assert.equal(comecaFrase("oi. ", 4), true);
  assert.equal(comecaFrase("oi", 2), false);
  assert.equal(comecaFrase("oi\n", 3), true);
  assert.equal(comecaFrase("oi, ", 4), false);
});

test("teclas: letras do português e acentos", () => {
  assert.equal(LETRAS.flat().length, 26); // sem tecla de ç: sai segurando o C
  assert.ok(!LETRAS.flat().includes("ç"));
  assert.ok(ACENTOS.c.includes("ç"));
  assert.equal(NUMEROS[0].join(""), "1234567890");
  for (const [k, v] of Object.entries(ACENTOS)) assert.ok(v.length > 0 && k.length === 1);
});

test("emojis: pacotes sem repetição, ids únicos e recentes sem passar do limite", () => {
  assert.equal(new Set(PACOTES.map((p) => p.id)).size, PACOTES.length);
  for (const p of PACOTES) { assert.ok(p.itens.length >= 20, p.id); assert.equal(new Set(p.itens).size, p.itens.length, p.id); }
  assert.deepEqual(somarRecente(["a", "b", "c"], "b"), ["b", "a", "c"]);
  const muitos = Array.from({ length: 40 }, (_, i) => `e${i}`);
  assert.equal(somarRecente(muitos, "x").length, MAX_RECENTES);
  assert.equal(somarRecente(muitos, "x")[0], "x");
});

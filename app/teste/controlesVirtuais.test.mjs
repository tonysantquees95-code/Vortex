import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { CONSOLES_VIRTUAIS, ESCOLHAS, limparDisposicoes } from "../src/controlesVirtuais.ts";
import { limparTema, TEMA_PADRAO } from "../src/tema.ts";

const java = readFileSync(new URL("../../android/src/DisposicaoControles.java", import.meta.url), "utf8");

test("cada console da lista existe no Java com o mesmo resumo do automático", () => {
  assert.equal(new Set(CONSOLES_VIRTUAIS.map((c) => c.id)).size, CONSOLES_VIRTUAIS.length);
  for (const c of CONSOLES_VIRTUAIS) {
    assert.ok(java.includes(`"${c.id}"`), `${c.id} não aparece no Java`);
    assert.ok(java.includes(`"${c.auto}"`), `resumo de ${c.id} difere do Java: ${c.auto}`);
  }
});

test("as escolhas do app são as mesmas que o Java entende", () => {
  for (const e of ESCOLHAS.filter((x) => x.id !== "auto")) assert.ok(java.includes(`"${e.id}"`), e.id);
  assert.equal(ESCOLHAS[0].id, "auto");
});

test("o PSP e o PS1 usam analógico no automático (o caso do Dante's Inferno)", () => {
  assert.match(java, /case "psp":\s*return d\(PEQUENO, true, false, PS/);
  assert.match(java, /case "ps1": case "ps2":\s*return d\(PEQUENO, true, true, PS/);
});

test("limparDisposicoes: só console válido e escolha conhecida; automático não é guardado", () => {
  assert.deepEqual(limparDisposicoes(null), {});
  assert.deepEqual(limparDisposicoes([1]), {});
  assert.deepEqual(limparDisposicoes({ psp: "ambos", nes: "auto", x: "ambos", "PSP": "ambos", snes: "lixo", n64: 3 }), { psp: "ambos" });
});

test("o tema guarda e limpa as escolhas por console", () => {
  assert.deepEqual(TEMA_PADRAO.disposicoes, {});
  assert.deepEqual(limparTema({ disposicoes: { psp: "direcional", "<x>": "ambos" } }).disposicoes, { psp: "direcional" });
  assert.deepEqual(limparTema({}).disposicoes, {});
});

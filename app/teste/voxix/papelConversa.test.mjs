import test from "node:test";
import assert from "node:assert/strict";

const guarda = new Map();
globalThis.localStorage = { getItem: (k) => (guarda.has(k) ? guarda.get(k) : null), setItem: (k, v) => void guarda.set(k, String(v)), removeItem: (k) => void guarda.delete(k) };
const { papelDaConversa, definirPapelDaConversa, esquecerPapelDaConversa } = await import("../../src/voxix/papelConversa.ts");

test("papel por conversa: sem escolha usa o padrão do app (null)", () => {
  assert.equal(papelDaConversa("ana"), null);
});

test("papel por conversa: cada conversa guarda o seu, sem misturar", () => {
  assert.ok(definirPapelDaConversa("Ana", { modelo: "aurora", escurecer: 40 }));
  assert.ok(definirPapelDaConversa("beto", { modelo: "grade", escurecer: 10 }));
  assert.equal(papelDaConversa("ana").cfg.modelo, "aurora");
  assert.equal(papelDaConversa("ANA").cfg.escurecer, 40);
  assert.equal(papelDaConversa("beto").cfg.modelo, "grade");
  assert.equal(papelDaConversa("carla"), null);
});

test("papel por conversa: foto só vale se for JPEG pequeno e válido; se não couber, devolve false", () => {
  const foto = "data:image/jpeg;base64,AAAA";
  assert.ok(definirPapelDaConversa("duda", { modelo: "foto", escurecer: 30 }, foto));
  assert.equal(papelDaConversa("duda").foto, foto);
  assert.equal(definirPapelDaConversa("edu", { modelo: "foto", escurecer: 30 }, "http://site.com/x.png"), false);
  assert.equal(papelDaConversa("edu"), null);
});

test("papel por conversa: voltar ao padrão ou apagar a conversa limpa tudo", () => {
  definirPapelDaConversa("fabi", { modelo: "foto", escurecer: 30 }, "data:image/jpeg;base64,BBBB");
  definirPapelDaConversa("fabi", null);
  assert.equal(papelDaConversa("fabi"), null);
  assert.equal(guarda.has("voxix.papel.convfoto.fabi"), false);
  definirPapelDaConversa("gabi", { modelo: "pontos", escurecer: 20 });
  esquecerPapelDaConversa("gabi");
  assert.equal(papelDaConversa("gabi"), null);
});

test("papel por conversa: dados estragados no aparelho não derrubam o app", () => {
  guarda.set("voxix.papel.conv", "{isso não é json");
  assert.equal(papelDaConversa("ana"), null);
  guarda.set("voxix.papel.conv", JSON.stringify({ ana: { modelo: "inexistente", escurecer: 999 }, bia: { modelo: "aurora", escurecer: 999 } }));
  assert.equal(papelDaConversa("ana"), null);
  assert.equal(papelDaConversa("bia").cfg.escurecer, 85);
});

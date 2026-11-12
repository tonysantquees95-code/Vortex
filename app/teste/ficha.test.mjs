import test from "node:test";
import assert from "node:assert/strict";
import { semelhanca, anoDeWikidata, resumir, atalhosDeGuia } from "../src/ficha.ts";

test("títulos parecidos passam, diferentes não", () => {
  assert.ok(semelhanca("God of War - Ghost of Sparta", "God of War: Ghost of Sparta") >= 0.9);
  assert.ok(semelhanca("Sonic the Hedgehog (USA)", "Sonic the Hedgehog") >= 0.9);
  assert.ok(semelhanca("Zelda", "Mario Kart 64") < 0.3);
});
test("ano vem da data do Wikidata", () => {
  assert.equal(anoDeWikidata("+1990-03-04T00:00:00Z"), 1990);
  assert.equal(anoDeWikidata("x"), undefined);
  assert.equal(anoDeWikidata("+0200-01-01T00:00:00Z"), undefined);
});
test("resumo corta em frase inteira", () => {
  const t = "Primeira frase. ".repeat(60);
  const r = resumir(t, 100);
  assert.ok(r.length <= 100 && r.endsWith("."));
  assert.equal(resumir("Curto.", 100), "Curto.");
});
test("atalhos de guia são https e com o nome do jogo", () => {
  const a = atalhosDeGuia("God of War - Ghost of Sparta", "psp");
  assert.equal(a.length, 3);
  assert.ok(a.every((x) => x.url.startsWith("https://") && x.url.includes("God")));
});

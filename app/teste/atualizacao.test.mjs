import test from "node:test";
import assert from "node:assert/strict";
import { haNovaVersao, precisaConferir, versaoValida, BUILD } from "../src/atualizacao.ts";

test("só avisa de versão nova quando o build instalado é conhecido e menor", () => {
  assert.equal(haNovaVersao(10, 11), true);
  assert.equal(haNovaVersao(11, 11), false);
  assert.equal(haNovaVersao(0, 50), false);
  assert.equal(haNovaVersao(10, undefined), false);
  assert.equal(BUILD, 0);
});

test("confere de novo só depois de algumas horas (ou se o relógio voltou)", () => {
  const h = 3_600_000;
  assert.equal(precisaConferir(0, 1000), true);
  assert.equal(precisaConferir(1000, 1000 + 2 * h), false);
  assert.equal(precisaConferir(1000, 1000 + 7 * h), true);
  assert.equal(precisaConferir(5000, 1000), true);
});

test("só aceita download de endereços https do GitHub", () => {
  const ok = { numero: 12, tag: "1.12", notas: "x", tamanho: 5, sha256: "A".repeat(64), url: "https://github.com/o/r/releases/download/1.12/Vortex.apk" };
  assert.equal(versaoValida(ok)?.numero, 12);
  assert.equal(versaoValida(ok)?.sha256, "a".repeat(64));
  assert.equal(versaoValida({ ...ok, url: "http://github.com/x" }), null);
  assert.equal(versaoValida({ ...ok, url: "https://github.com.evil.com/x" }), null);
  assert.equal(versaoValida({ ...ok, url: "https://evil.com/github.com" }), null);
  assert.equal(versaoValida({ ...ok, sha256: "zz" })?.sha256, "");
  assert.equal(versaoValida(null), null);
});

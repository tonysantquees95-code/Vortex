import test from "node:test";
import assert from "node:assert/strict";
import { limparTema, TEMA_PADRAO, coresDoTema, textoSobre, segundaDe, hexValido } from "../src/tema.ts";

test("o tema padrão é vermelho, com fundo que segue o console e abertura ligada", () => {
  assert.equal(TEMA_PADRAO.cor, "vermelho");
  assert.equal(TEMA_PADRAO.fundo, "console");
  assert.equal(TEMA_PADRAO.abertura, true);
  assert.deepEqual(limparTema(null), TEMA_PADRAO);
});

test("valores estranhos guardados são corrigidos", () => {
  const t = limparTema({ cor: "<script>", brilho: 900, fundo: "x", cartas: "enorme", animacoes: "sim" });
  assert.equal(t.cor, "vermelho");
  assert.equal(t.brilho, 100);
  assert.equal(t.fundo, "console");
  assert.equal(t.cartas, "medio");
  assert.equal(t.animacoes, true);
  assert.equal(limparTema({ cor: "#12ab9f" }).cor, "#12ab9f");
  assert.equal(limparTema({ cor: "azul", brilho: -5 }).brilho, 0);
});

test("cores prontas e personalizadas", () => {
  assert.equal(coresDoTema({ ...TEMA_PADRAO, cor: "ciano" }).principal, "#19e3ff");
  const p = coresDoTema({ ...TEMA_PADRAO, cor: "#00ff00" });
  assert.equal(p.principal, "#00ff00");
  assert.ok(hexValido(p.segunda));
  assert.ok(hexValido(segundaDe("#ffffff")));
});

test("texto sobre a cor principal é legível", () => {
  assert.equal(textoSobre("#ff2a3d"), "#ffffff");
  assert.equal(textoSobre("#ffc21a"), "#08090f");
  assert.equal(textoSobre("#2dff8a"), "#08090f");
});

test("fundos novos, foto e capa só entram se forem válidos", () => {
  assert.equal(limparTema({ fundo: "aurora" }).fundo, "aurora");
  assert.equal(limparTema({ fundo: "vortex" }).fundo, "console", "o fundo antigo vira o padrão");
  assert.equal(limparTema({ foto: "data:image/jpeg;base64,/9j/4AAQ" }).foto, "data:image/jpeg;base64,/9j/4AAQ");
  assert.equal(limparTema({ foto: "javascript:alert(1)" }).foto, null);
  assert.equal(limparTema({ foto: "data:text/html;base64,AAAA" }).foto, null);
  assert.equal(limparTema({ capaFundo: "https://thumbnails.libretro.com/a/b.png" }).capaFundo, "https://thumbnails.libretro.com/a/b.png");
  assert.equal(limparTema({ capaFundo: "https://x/y\") ; alert(1" }).capaFundo, null);
  assert.equal(limparTema({ capaFundo: "http://insegura/x.png" }).capaFundo, null);
});

import { TEMAS_PRONTOS, aplicarPronto, prontoAtual, FUNDOS_VALIDOS } from "../src/tema.ts";

test("temas prontos: ids únicos, fundos e cores válidos", () => {
  const ids = TEMAS_PRONTOS.map((p) => p.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.ok(TEMAS_PRONTOS.length >= 8);
  for (const p of TEMAS_PRONTOS) {
    assert.ok(FUNDOS_VALIDOS.includes(p.ajustes.fundo), p.id);
    assert.ok(p.nome.length > 2 && p.descricao.length > 10, p.id);
  }
});

test("aplicar um tema pronto troca a aparência e preserva foto, capa e botões do jogo", () => {
  const base = { ...TEMA_PADRAO, foto: "data:image/png;base64,AAAA", botoes: "neon", opacidadeBotoes: 60 };
  const t = aplicarPronto(base, "tubo");
  assert.equal(t.fundo, "crt");
  assert.equal(t.cor, "dourado");
  assert.equal(t.foto, "data:image/png;base64,AAAA");
  assert.equal(t.botoes, "neon");
  assert.equal(t.opacidadeBotoes, 60);
  assert.equal(prontoAtual(t), "tubo");
  assert.equal(prontoAtual({ ...t, brilho: 3 }), null);
  assert.equal(aplicarPronto(base, "nao-existe"), base);
});

test("os fundos novos sobrevivem ao salvar e ler", () => {
  for (const f of ["crt", "vidro", "preto"]) assert.equal(limparTema({ fundo: f }).fundo, f);
});

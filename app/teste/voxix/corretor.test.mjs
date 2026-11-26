import test from "node:test";
import assert from "node:assert/strict";
import { aplicarSeparador, corrigirFim, criarDicionario, desfazerCorrecao, igualarCaixa, palavraAntesDoCursor, semAcento, sugerir, trocarPalavra } from "../../src/voxix/corretor.ts";

// lista curta, da mais comum para a menos comum (a posição é a "frequência")
const D = criarDicionario(["de", "que", "não", "é", "para", "você", "está", "esta", "também", "casa", "carro", "olá", "mãe", "já", "pra", "gg", "tô", "carta", "caro"]);
const nenhuma = new Set();
const digitar = (texto, sep, pessoais = nenhuma) => aplicarSeparador(D, pessoais, texto, texto.length, texto.length, sep);

test("semAcento e caixa da palavra", () => {
  assert.equal(semAcento("você já está"), "voce ja esta");
  assert.equal(igualarCaixa("Voce", "você"), "Você");
  assert.equal(igualarCaixa("VOCE", "você"), "VOCÊ");
  assert.equal(igualarCaixa("voce", "você"), "você");
});

test("palavra antes do cursor e trecho", () => {
  assert.deepEqual(palavraAntesDoCursor("oi voce", 7), { ini: 3, palavra: "voce", trecho: "voce" });
  assert.deepEqual(palavraAntesDoCursor("oi ", 3), { ini: 3, palavra: "", trecho: "" });
  assert.equal(palavraAntesDoCursor("veja site.com/abc", 17).trecho, "site.com/abc");
});

test("acentos faltando são colocados ao dar espaço", () => {
  assert.equal(digitar("oi voce", " ").texto, "oi você ");
  assert.equal(digitar("nao", " ").texto, "não ");
  assert.equal(digitar("tambem", ",").texto, "também,");
  assert.equal(digitar("mae", "!").texto, "mãe!");
  assert.equal(digitar("Voce", " ").texto, "Você ");
  assert.equal(digitar("VOCE", " ").texto, "VOCÊ ");
});

test("erro de digitação comum é consertado; o cursor fica depois do separador", () => {
  const r = digitar("minha cassa", " ");
  assert.equal(r.texto, "minha casa ");
  assert.equal(r.pos, 11);
});

test("não mexe no que está certo, em gírias, risadas, siglas, links e números", () => {
  assert.equal(digitar("esta", " ").texto, "esta "); // existe: não vira "está"
  assert.equal(digitar("gg", " ").texto, "gg ");
  assert.equal(digitar("kkkkk", " ").texto, "kkkkk ");
  assert.equal(digitar("FPS", " ").texto, "FPS ");
  assert.equal(digitar("veja voce.com", " ").texto, "veja voce.com ");
  assert.equal(digitar("@voce", " ").texto, "@voce ");
  assert.equal(digitar("nick123 voce1", " ").texto, "nick123 voce1 ");
  assert.equal(digitar("xyzw", " ").texto, "xyzw ");
});

test("palavras ensinadas pela pessoa não são mexidas", () => {
  assert.equal(digitar("voce", " ", new Set(["voce"])).texto, "voce ");
});

test("selecionado: só insere, sem corrigir", () => {
  assert.deepEqual(aplicarSeparador(D, nenhuma, "voce abc", 0, 4, " "), { texto: "  abc", pos: 1, correcao: null });
});

test("apagar logo depois da troca devolve o que a pessoa escreveu", () => {
  const r = digitar("oi voce", " ");
  assert.ok(r.correcao);
  const volta = desfazerCorrecao(r.texto, r.pos, r.correcao);
  assert.deepEqual(volta, { texto: "oi voce ", pos: 8 });
  assert.equal(desfazerCorrecao(r.texto, r.pos - 1, r.correcao), null); // cursor mudou de lugar
  assert.equal(desfazerCorrecao("outro texto", r.pos, r.correcao), null);
});

test("sugestões: completar, consertar e já escrito certo", () => {
  assert.deepEqual(sugerir(D, "voce").opcoes.slice(0, 1), ["você"]);
  assert.equal(sugerir(D, "voce").valida, false);
  assert.equal(sugerir(D, "voce").auto, "você");
  const c = sugerir(D, "ca");
  assert.equal(c.valida, false); // "ca" não é palavra
  assert.deepEqual(c.opcoes, ["casa", "carro", "carta"]);
  const ok = sugerir(D, "casa");
  assert.equal(ok.valida, true);
  assert.equal(ok.auto, null);
  assert.deepEqual(sugerir(D, "voc").opcoes, ["você"]);
  assert.deepEqual(sugerir(D, "").opcoes, []);
});

test("tocar numa sugestão troca a palavra e põe um espaço", () => {
  assert.deepEqual(trocarPalavra("oi voc", 6, "você"), { texto: "oi você ", pos: 8 });
  assert.deepEqual(trocarPalavra("oi voc ola", 6, "você"), { texto: "oi você ola", pos: 8 });
});

test("ao enviar, a última palavra também é conferida", () => {
  assert.equal(corrigirFim(D, nenhuma, "tudo bem com voce"), "tudo bem com você");
  assert.equal(corrigirFim(D, nenhuma, "ola"), "olá");
  assert.equal(corrigirFim(D, nenhuma, "tudo bem"), "tudo bem");
});

test("dicionário com fim de linha do Windows (\\r\\n) funciona igual", () => {
  const d = criarDicionario(["vendo\r", "testando\r", "alguns\r", "alguma\r"]);
  assert.equal(sugerir(d, "vendo").valida, true);
  assert.equal(sugerir(d, "vebdo").auto, "vendo");
  assert.equal(sugerir(d, "Testanndo").auto, "Testando");
});

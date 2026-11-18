// Teste visual: abre o app (já compilado em dist/) em vários tamanhos de tela e confere cada tela e janela:
// cabe na tela, não estoura para o lado e todo botão dá para alcançar (direto ou rolando).
// As telas a visitar ficam em config.mjs. Fotos em teste-visual/fotos/ (a publicação guarda como artefato).
// Rodar: npm run build && npm run test:visual   (CHROME=/caminho/do/chrome se o Chrome não for achado sozinho)
import { spawn } from "node:child_process";
import { mkdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { chromium } from "playwright-core";
import config from "./config.mjs";

const PORTA = config.porta ?? 4179;
const FOTOS = fileURLToPath(new URL("./fotos/", import.meta.url));
mkdirSync(FOTOS, { recursive: true });

const TAMANHOS = [
  ["celular-pequeno", 320, 568],
  ["celular", 360, 640],
  ["celular-grande", 412, 915],
  ["celular-deitado", 740, 360],
  ["tablet", 768, 1024],
  ["janela-pequena", 800, 500],
  ["janela-windows", 1280, 720],
];

/** Dentro da página: devolve a lista de problemas encontrados na tela e nas janelas abertas. */
function conferirNaPagina() {
  const vw = innerWidth, vh = innerHeight, problemas = [];
  const visivel = (e) => { const r = e.getBoundingClientRect(); const s = getComputedStyle(e); return r.width > 0 && r.height > 0 && s.visibility !== "hidden" && s.display !== "none" && s.opacity !== "0"; };
  const nome = (e) => (e.getAttribute("aria-label") || e.textContent || e.tagName).trim().replace(/\s+/g, " ").slice(0, 40);
  const rolavel = (e) => { const s = getComputedStyle(e); return /(auto|scroll)/.test(s.overflowY) && e.scrollHeight > e.clientHeight + 1; };
  const rolavelX = (e) => { const s = getComputedStyle(e); return /(auto|scroll)/.test(s.overflowX) && e.scrollWidth > e.clientWidth + 1; };
  if (document.documentElement.scrollWidth > vw + 1) problemas.push(`a página estoura para o lado (${document.documentElement.scrollWidth}px > ${vw}px)`);
  const alvos = "button, a[href], input, select, textarea, [role=button]";
  // fora da tela para o lado (e que não está dentro de uma faixa que rola para o lado)
  for (const b of document.querySelectorAll(alvos)) {
    if (!visivel(b)) continue;
    const r = b.getBoundingClientRect();
    if (r.right <= vw + 1 && r.left >= -1) continue;
    if (r.right <= 1 || r.left >= vw - 1) continue; // inteiro fora da tela = painel escondido de propósito (menu fechado)
    let pai = b.parentElement, dentro = false;
    while (pai) { if (rolavelX(pai)) { dentro = true; break; } pai = pai.parentElement; }
    if (!dentro) problemas.push(`o item "${nome(b)}" fica cortado para o lado (${Math.round(r.left)}→${Math.round(r.right)} de ${vw}px)`);
  }
  // letras miúdas demais para ler
  for (const e of document.querySelectorAll("button, a, p, span, label, h1, h2, h3, li")) {
    if (!visivel(e) || !e.childNodes.length || ![...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) continue;
    if (parseFloat(getComputedStyle(e).fontSize) < 9.5) { problemas.push(`texto pequeno demais para ler ("${nome(e)}" com ${getComputedStyle(e).fontSize})`); break; }
  }
  // janelas = elementos fixos que cobrem a tela
  const janelas = [...document.querySelectorAll("body *")].filter((e) => { const s = getComputedStyle(e); const r = e.getBoundingClientRect(); return s.position === "fixed" && r.width >= vw - 2 && r.height >= vh - 2 && visivel(e); });
  for (const j of janelas) {
    for (const cartao of [...j.children].filter(visivel)) {
      const r = cartao.getBoundingClientRect();
      if (r.right <= 1 || r.left >= vw - 1) continue; // painel escondido de propósito (menu fechado)
      if (r.bottom > vh + 1 || r.top < -1) problemas.push(`uma janela passa da altura da tela (${Math.round(r.top)}→${Math.round(r.bottom)} de ${vh}px) e não rola`);
      if (r.right > vw + 1 || r.left < -1) problemas.push(`uma janela passa da largura da tela (${Math.round(r.left)}→${Math.round(r.right)} de ${vw}px)`);
    }
    for (const b of j.querySelectorAll(alvos)) {
      if (!visivel(b)) continue;
      let pai = b.parentElement, rolagem = null;
      while (pai && pai !== j.parentElement) { if (rolavel(pai)) { rolagem = pai; break; } pai = pai.parentElement; }
      if (rolagem) b.scrollIntoView({ block: "nearest" });
      const r = b.getBoundingClientRect();
      if (r.bottom > vh + 1 || r.top < -1) problemas.push(`o botão "${nome(b)}" fica fora da tela e não dá para alcançar`);
    }
  }
  // avisos (não reprovam a publicação, mas aparecem no relatório): contraste baixo e botão pequeno para o dedo
  const avisos = [];
  const cor = (s) => { const k = s.match(/^color\(srgb ([\d.]+) ([\d.]+) ([\d.]+)(?: \/ ([\d.]+))?\)/); if (k) return { r: k[1] * 255, g: k[2] * 255, b: k[3] * 255, a: k[4] === undefined ? 1 : Number(k[4]) }; const m = s.match(/rgba?\(([^)]+)\)/); if (!m) return null; const [r, g, b, a = 1] = m[1].split(/[ ,\/]+/).map(Number); return { r, g, b, a }; };
  const lum = ({ r, g, b }) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  const fundoDe = (e) => { for (let x = e; x; x = x.parentElement) { const s = getComputedStyle(x); if (s.backgroundImage !== "none") return null; const bruto = s.backgroundColor; if (bruto === "rgba(0, 0, 0, 0)" || bruto === "transparent") continue; const c = cor(bruto); if (!c) return null; if (c.a >= 0.5) return c; } return { r: 0, g: 0, b: 0 }; };
  let pior = null;
  for (const e of document.querySelectorAll("button, a, p, span, label, h1, h2, h3, li, b")) {
    if (!visivel(e) || ![...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) continue;
    const f = fundoDe(e), c = cor(getComputedStyle(e).color); if (!f || !c || c.a < 0.95) continue;
    const l1 = lum(c), l2 = lum(f), razao = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
    if (razao < 3 && (!pior || razao < pior.razao)) pior = { razao, texto: nome(e) };
  }
  if (pior) avisos.push(`contraste baixo (${pior.razao.toFixed(1)}:1) em "${pior.texto}"`);
  if (vw <= 768) {
    const pequenos = [...document.querySelectorAll("button, a[href], [role=button]")].filter((b) => { if (!visivel(b)) return false; const r = b.getBoundingClientRect(); if (r.right <= 1 || r.left >= vw - 1 || r.top >= vh) return false; return r.height < 32 && r.width < 44 || r.height < 24; });
    if (pequenos.length) avisos.push(`${pequenos.length} botão(ões) pequeno(s) para o dedo, ex.: "${nome(pequenos[0])}"`);
  }
  return { problemas: [...new Set(problemas)], avisos };
}

async function abrir(browser, w, h, modo) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  await ctx.addInitScript((guardar) => { for (const [k, v] of Object.entries(guardar)) localStorage.setItem(k, v); }, config.guardado(modo));
  await ctx.route(/workers\.dev|vetorial|venus-servidor/, async (rota) => {
    const caminho = new URL(rota.request().url()).pathname;
    const cors = { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "*" };
    if (rota.request().method() === "OPTIONS") return rota.fulfill({ status: 204, headers: cors });
    await rota.fulfill({ status: 200, headers: cors, contentType: "application/json", body: JSON.stringify(config.respostas?.[caminho] ?? {}) });
  });
  const p = await ctx.newPage();
  const erros = [];
  p.on("pageerror", (e) => erros.push(`erro na página: ${e.message}`));
  await p.goto(`http://localhost:${PORTA}/${config.caminhoInicial ?? ""}`);
  await p.waitForTimeout(config.espera ?? 600);
  return { ctx, p, erros };
}

/** Atalhos para os cenários. */
const ajuda = {
  /** Abre uma aba do app: pela barra lateral (tela larga) ou pelo menu (celular). */
  /** Abre uma seção do Vortex pelo dock (as seções ficam em <nav aria-label="Seções">). */
  async aba(p, rotulo) {
    const dock = p.locator("nav.dock").first();
    const b = dock.getByRole("button", { name: rotulo, exact: true });
    if (!(await b.count())) throw new Error("PULAR: seção não existe nesta versão");
    await b.first().click();
    await p.waitForTimeout(450);
  },
};

const preview = spawn(process.execPath, [join(dirname(createRequire(import.meta.url).resolve("vite/package.json")), "bin/vite.js"), "preview", "--port", String(PORTA), "--strictPort"], { stdio: "ignore", cwd: fileURLToPath(new URL("..", import.meta.url)) });
const cromo = process.env.CHROME || ["/usr/bin/google-chrome", "C:/Program Files/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe"].find(existsSync);
let falhas = 0, total = 0;
const avisosTotal = new Map();
try {
  for (let i = 0; i < 40; i++) { try { if ((await fetch(`http://localhost:${PORTA}/`)).ok) break; } catch { /* ainda subindo */ } await new Promise((r) => setTimeout(r, 250)); }
  const browser = await chromium.launch(cromo ? { executablePath: cromo } : { channel: "chrome" });
  for (const [tam, w, h] of TAMANHOS.filter(([n]) => !process.env.TAMANHO || n === process.env.TAMANHO)) {
    for (const [nome, modo, passos] of config.cenarios.filter(([n]) => !process.env.TELA || n === process.env.TELA)) {
      total++;
      const { ctx, p, erros } = await abrir(browser, w, h, modo);
      let problemas = [], avisos = [];
      try {
        await passos(p, ajuda);
        await p.waitForTimeout(150);
        ({ problemas, avisos } = await p.evaluate(conferirNaPagina));
      } catch (e) {
        if (String(e.message).startsWith("PULAR")) { total--; await ctx.close(); continue; }
        problemas = [`não consegui abrir a tela: ${String(e.message).split("\n")[0]}`]; if (process.env.DEPURAR) console.log(e.message);
      }
      problemas.push(...erros);
      for (const av of avisos) { const k = `${nome}: ${av.replace(/\d+ botão/, "N botão").replace(/\(\d+(\.\d+)?:1\)/, "")}`; if (!avisosTotal.has(k)) avisosTotal.set(k, []); avisosTotal.get(k).push(tam); }
      await p.screenshot({ path: `${FOTOS}${nome}__${tam}.png` });
      if (problemas.length) { falhas++; console.log(`✗ ${nome} em ${tam} (${w}x${h}): ${problemas.join("; ")}`); } else console.log(`✓ ${nome} em ${tam}`);
      await ctx.close();
    }
  }
  await browser.close();
} finally { preview.kill(); }
if (avisosTotal.size) { console.log("\nAvisos (não reprovam):"); for (const [k, v] of avisosTotal) console.log(`⚠ ${k} — em ${v.length} tamanho(s)`); }
console.log(`\n${total - falhas}/${total} telas ok`);
process.exit(falhas ? 1 : 0);

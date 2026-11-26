// Teste de segurança do app (igual em todos os apps da suíte Vetorial; rode: npm test).
// Confere o REPOSITÓRIO inteiro: segredos no código, arquivos que nunca podem ser versionados,
// configuração insegura (CSP do Tauri, manifesto do Android) e código perigoso.
// Exceção justificada = uma linha em seguranca.permitidos.json (arquivo + trecho + motivo); sem motivo, não vale.
import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

process.removeAllListeners("warning");
const aqui = dirname(fileURLToPath(import.meta.url));
let raiz = aqui;
while (!existsSync(join(raiz, "CLAUDE.md")) && !existsSync(join(raiz, ".git")) && dirname(raiz) !== raiz) raiz = dirname(raiz);

const IGNORAR = /(^|\/)(node_modules|target|dist|dist-demo|build|www|\.git|\.gradle|coverage|legado|public-pdf|ocr)(\/|$)|package-lock\.json$|Cargo\.lock$|\.(png|jpe?g|gif|webp|ico|icns|woff2?|ttf|otf|wasm|gz|zip|mp3|ogg|wav|mp4|pdf|traineddata|bin|apk|aab|jar)$/i;
function arquivos() {
  try {
    const l = execFileSync("git", ["ls-files", "-z", "--cached", "--others", "--exclude-standard"], { cwd: raiz, maxBuffer: 1 << 28 }).toString().split("\0").filter(Boolean);
    return l.filter((f) => !IGNORAR.test(f) && existsSync(join(raiz, f)));
  } catch {
    const fora = [];
    const anda = (d) => { for (const n of readdirSync(d)) { const p = join(d, n); const rel = relative(raiz, p).split(sep).join("/"); if (IGNORAR.test(rel)) continue; statSync(p).isDirectory() ? anda(p) : fora.push(rel); } };
    anda(raiz); return fora;
  }
}
const ARQ = arquivos();
const lerTexto = (f) => { try { const b = readFileSync(join(raiz, f)); return b.length > 2_000_000 || b.includes(0) ? "" : b.toString("utf8"); } catch { return ""; } };
const permitidos = existsSync(join(aqui, "seguranca.permitidos.json")) ? JSON.parse(readFileSync(join(aqui, "seguranca.permitidos.json"), "utf8")) : [];
const liberado = (regra, f, linha) => permitidos.some((p) => p.regra === regra && f.endsWith(p.arquivo) && linha.includes(p.trecho) && String(p.motivo || "").length > 8);
const EH_TESTE = /(^|\/)(teste|teste-visual|test|tests|__tests__)\//i;
const EH_CODIGO = /\.(m?[jt]sx?|kt|java|rs)$/;

function achar(regra, regex, { so = EH_CODIGO, ignorarTestes = true } = {}) {
  const achados = [];
  for (const f of ARQ) {
    if (!so.test(f) || (ignorarTestes && EH_TESTE.test(f))) continue;
    const linhas = lerTexto(f).split("\n");
    linhas.forEach((l, i) => { if (regex.test(l) && !liberado(regra, f, l)) achados.push(`${f}:${i + 1}  ${l.trim().slice(0, 400)}`); });
  }
  return achados;
}
const vazio = (a, msg) => assert.deepEqual(a, [], `${msg}\n  ${a.join("\n  ")}`);

test("nenhum segredo escrito no código (chaves, tokens, senhas)", () => {
  const padroes = [
    /AIza[0-9A-Za-z_-]{35}/, /gh[pousr]_[A-Za-z0-9]{36,}/, /github_pat_[A-Za-z0-9_]{50,}/, /\bsk-[A-Za-z0-9_-]{32,}/, /\bgsk_[A-Za-z0-9]{40,}/,
    /-----BEGIN (RSA |EC |OPENSSH |)PRIVATE KEY-----/, /\bAKIA[0-9A-Z]{16}\b/, /xox[abprs]-[A-Za-z0-9-]{20,}/, /\bAPP_USR-[0-9a-f-]{30,}/, /\bTEST-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/,
    /(?:api[_-]?key|secret|token|senha|password|passwd)["']?\s*[:=]\s*["'][A-Za-z0-9+/_\-]{24,}["']/i,
  ];
  const ach = [];
  for (const f of ARQ) {
    if (/\.(md|lock)$/.test(f) || EH_TESTE.test(f)) continue;
    lerTexto(f).split("\n").forEach((l, i) => { if (padroes.some((p) => p.test(l)) && !liberado("segredo", f, l)) ach.push(`${f}:${i + 1}  ${l.trim().slice(0, 40)}…`); });
  }
  vazio(ach, "Possível segredo no código (use os Secrets do GitHub ou o servidor):");
});

test("arquivos que nunca podem ir para o repositório", () => {
  const ruim = ARQ.filter((f) => /(^|\/)\.env(\.|$)|\.(jks|keystore|p12|pfx|pem|key)$|(^|\/)(google-services\.json|local\.properties|id_rsa)$|(^|\/)segredos?\.(json|txt|ya?ml)$/i.test(f) && !/\.example$|exemplo/i.test(f) && !liberado("arquivo", f, f));
  const npmrc = ARQ.filter((f) => /(^|\/)\.npmrc$/.test(f) && /_auth|_password|:_authToken/i.test(lerTexto(f)));
  vazio([...ruim, ...npmrc], "Arquivo sensível versionado:");
});

test("Tauri: CSP fechada (sem eval, sem curinga, sem http aberto)", () => {
  for (const f of ARQ.filter((x) => /(^|\/)tauri\.conf\.json$/.test(x))) {
    const c = JSON.parse(lerTexto(f));
    const csp = c?.app?.security?.csp ?? c?.tauri?.security?.csp;
    assert.ok(csp, `${f}: sem CSP definida`);
    const texto = typeof csp === "string" ? csp : Object.entries(csp).map(([k, v]) => `${k} ${v}`).join("; ");
    assert.ok(!/'unsafe-eval'/.test(texto), `${f}: CSP com 'unsafe-eval'`);
    assert.ok(!/script-src[^;]*('unsafe-inline'|\*|https?:)/.test(texto), `${f}: script-src aberto demais`);
    assert.ok(!/(default-src|connect-src|frame-src|img-src)[^;]*(\s\*(\s|;|$)|\shttp:(\s|;|$))/.test(texto), `${f}: CSP com curinga ou http: puro`);
    assert.ok(!/object-src[^;]*[^n]\*/.test(texto) , `${f}: object-src aberto`);
    assert.equal(c?.app?.security?.dangerousDisableAssetCspModification ?? false, false, `${f}: dangerousDisableAssetCspModification ligado`);
  }
});

test("Android: manifesto sem debug, sem tráfego aberto e sem componente exposto à toa", () => {
  const manifestos = ARQ.filter((f) => /AndroidManifest\.xml$/.test(f));
  const gradle = ARQ.filter((f) => /(build\.gradle(\.kts)?|\.ya?ml)$/.test(f));
  for (const f of manifestos) {
    const x = lerTexto(f);
    assert.ok(!/android:debuggable="true"/.test(x), `${f}: debuggable`);
    assert.ok(!/usesCleartextTraffic="true"/.test(x) || liberado("cleartext", f, "usesCleartextTraffic"), `${f}: tráfego http liberado`);
    for (const m of x.matchAll(/<(activity|service|receiver|provider)\b[^>]*android:exported="true"[^>]*?(\/>|>[\s\S]*?<\/\1>)/g)) {
      const tem = /<intent-filter/.test(m[0]) || /android:(read|write)?[pP]ermission=/.test(m[0]);
      const nome = (/android:name="([^"]+)"/.exec(m[0]) || [])[1] || "?";
      assert.ok(tem || liberado("exportado", f, nome), `${f}: ${nome} exportado sem filtro de intenção nem permissão`);
    }
  }
  for (const f of gradle) {
    const x = lerTexto(f);
    assert.ok(!/debuggable\s*(=|\s)\s*true/.test(x) || EH_TESTE.test(f), `${f}: build de release com debuggable`);
    assert.ok(!/android:usesCleartextTraffic[^\n]*true|usesCleartextTraffic["']?\s*[:=]\s*["']?true/.test(x), `${f}: workflow liga tráfego http`);
    assert.ok(!/QUERY_ALL_PACKAGES/.test(x) || liberado("permissao", f, "QUERY_ALL_PACKAGES"), `${f}: QUERY_ALL_PACKAGES (ver todos os apps instalados) precisa de justificativa em seguranca.permitidos.json`);
  }
});

test("código perigoso: eval, new Function, document.write", () => {
  vazio(achar("eval", /(^|[^.\w])eval\s*\(|new\s+Function\s*\(|document\.write(ln)?\s*\(/), "Execução de texto como código:");
});

/** innerHTML = "texto fixo" (sem variável, sem ${}) é seguro; o que preocupa é HTML que mistura texto vindo de fora. */
const SO_TEXTO_FIXO = (l) => {
  const m = /\.(?:inner|outer)HTML\s*=\s*([^;]*)/.exec(l);
  if (!m || /dangerouslySetInnerHTML|insertAdjacentHTML/.test(l)) return false;
  let r = m[1];
  if (/\$\{/.test(r)) return false;
  r = r.replace(/"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`[^`$]*`/g, "");
  return /^[\s)}]*$/.test(r);
};
test("HTML montado à mão: innerHTML / dangerouslySetInnerHTML só com justificativa", () => {
  const todos = achar("html", /dangerouslySetInnerHTML|\.(inner|outer)HTML\s*(\+?=)|insertAdjacentHTML\s*\(/, { so: /\.(m?[jt]sx?|html)$/ });
  vazio(todos.filter((a) => !SO_TEXTO_FIXO(a.replace(/^.*?:\d+\s\s/, ""))), "HTML montado com texto (risco de script injetado). Use textContent ou registre em seguranca.permitidos.json com o motivo:");
});

test("endereços http:// (sem criptografia) só para a máquina local", () => {
  const ach = achar("http", /["'`]http:\/\/(?!localhost|127\.0\.0\.1|10\.0\.2\.2|0\.0\.0\.0|www\.w3\.org|schemas\.android\.com|\$\{|\[::1\]|tauri\.localhost|ipc\.localhost)[^"'`\s]+/, { so: /\.(m?[jt]sx?|kt|java|rs|html)$/ })
    .filter((l) => !/xmlns|DOCTYPE|namespace|apache\.org\/licenses|assert(_eq|_ne)?!?\(/i.test(l));
  vazio(ach, "Endereço http:// sem criptografia:");
});

test("senha e token nunca vão para o log", () => {
  vazio(achar("log", /(console\.(log|info|debug|warn|error)|Log\.[dviwe]|println!|eprintln!|print(ln)?\()[^;\n]*\b(senha|password|token|authorization|bearer|apikey|api_key|secret)\b[^;\n]*/i, {}).filter((l) => !/["'`][^"'`]*\b(token|senha|password)\b[^"'`]*["'`]\s*[,)]?\s*$/.test(l) || /\$\{|\+\s*\w*(token|senha)/i.test(l)), "Possível segredo escrito no log:");
});

test("fetch com verificação de certificado nunca desligada", () => {
  vazio(achar("tls", /danger_accept_invalid_certs|rejectUnauthorized\s*:\s*false|NODE_TLS_REJECT_UNAUTHORIZED|TrustAllCerts|ALLOW_ALL_HOSTNAME_VERIFIER|HostnameVerifier\s*\{[^}]*true|setJavaScriptEnabled\(true\)[^\n]*addJavascriptInterface\(\w+,\s*"Android"\)/), "Verificação de HTTPS desligada:");
});

test("WebView do Android: sem acesso a arquivos e sem remote debugging em produção", () => {
  vazio(achar("webview", /setAllowUniversalAccessFromFileURLs\s*\(\s*true|setAllowFileAccessFromFileURLs\s*\(\s*true|setWebContentsDebuggingEnabled\s*\(\s*true\s*\)/, { so: /\.(kt|java)$/ }), "WebView com acesso perigoso:");
});

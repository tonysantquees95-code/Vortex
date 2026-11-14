import { useEffect, useRef } from "react";

// Vórtice em 3D desenhado na placa de vídeo (WebGL): um túnel em perspectiva com anéis e braços em espiral, luz no fundo e vôo para dentro.
// Cada ponto da tela é calculado na hora, então não tem imagem esticada nem serrilhado, e a animação roda na GPU.
const VERTICE = "attribute vec2 p; void main(){ gl_Position = vec4(p, 0.0, 1.0); }";
const FRAGMENTO = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform vec2 uRes; uniform float uT; uniform float uPos; uniform vec3 uA; uniform vec3 uB;
uniform float uBrilho; uniform float uFundo; uniform float uFlash;
void main(){
  vec2 p = (gl_FragCoord.xy - 0.5 * uRes) / min(uRes.x, uRes.y);
  p += 0.035 * vec2(sin(uT * 0.7), cos(uT * 0.9)) * (1.0 - 0.5 * uFundo);
  float d = length(p) + 1e-4;
  float a = atan(p.y, p.x);
  float z = 0.32 / d;                          // profundidade: o centro é o fundo do túnel
  float giro = a + z * 0.5 - uT * 0.3;         // a espiral gira enquanto afunda
  float v = z - uPos;                          // avanço para dentro
  float aneis = pow(0.5 + 0.5 * cos(v * 3.14159), 10.0);
  float finos = pow(0.5 + 0.5 * cos(v * 12.5664), 18.0) * 0.45;
  float bracos = pow(0.5 + 0.5 * cos(giro * 6.0), 16.0) + 0.35 * pow(0.5 + 0.5 * cos(giro * 18.0 + z), 24.0);
  float estrutura = aneis * 0.8 + finos + bracos * 1.1;
  float longe = smoothstep(0.015, 0.5, d);     // escurece perto do centro, de onde sai a luz
  float perto = 1.0 - smoothstep(0.75, 1.5, d);
  vec3 cor = mix(uB, uA, clamp(bracos * 0.6 + aneis * 0.5, 0.0, 1.0));
  vec3 c = cor * estrutura * longe * (0.35 + perto);
  float nucleo = 0.05 / (d + 0.03);            // luz no fim do vórtex
  c += mix(uA, vec3(1.0), 0.55) * nucleo * nucleo * 1.6;
  c += uA * 0.12 * exp(-d * 2.2);              // névoa colorida
  c *= uBrilho * (1.0 - 0.45 * uFundo);
  c += uFlash;
  c = pow(c, vec3(0.92));
  c += (fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453) - 0.5) / 255.0;
  gl_FragColor = vec4(c, 1.0);
}`;

function corDoTema(nome: string, padrao: [number, number, number]): [number, number, number] {
  try {
    const bruto = getComputedStyle(document.documentElement).getPropertyValue(nome).trim();
    const p = bruto.split(",").map((x) => Number(x.trim()) / 255);
    if (p.length === 3 && p.every((x) => Number.isFinite(x))) return [p[0], p[1], p[2]];
  } catch { /* usa a cor padrão */ }
  return padrao;
}

/** modo "abertura": voa para dentro e termina num clarão (3 s). modo "fundo": gira devagar, mais escuro, a 30 quadros por segundo. */
export function Vortice({ modo }: { modo: "abertura" | "fundo" }) {
  const tela = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = tela.current;
    if (!canvas) return;
    const gl = (canvas.getContext("webgl", { antialias: false, alpha: false, powerPreference: "high-performance" }) ?? canvas.getContext("experimental-webgl")) as WebGLRenderingContext | null;
    if (!gl) { canvas.style.display = "none"; return; }
    const compila = (tipo: number, fonte: string) => { const s = gl.createShader(tipo)!; gl.shaderSource(s, fonte); gl.compileShader(s); return s; };
    const prog = gl.createProgram()!;
    gl.attachShader(prog, compila(gl.VERTEX_SHADER, VERTICE));
    gl.attachShader(prog, compila(gl.FRAGMENT_SHADER, FRAGMENTO));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { canvas.style.display = "none"; return; }
    gl.useProgram(prog);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, "p");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    const u = (n: string) => gl.getUniformLocation(prog, n);
    const [uRes, uT, uPos, uA, uB, uBrilho, uFundo, uFlash] = ["uRes", "uT", "uPos", "uA", "uB", "uBrilho", "uFundo", "uFlash"].map(u);
    const fundo = modo === "fundo";
    const a = corDoTema("--neon-rgb", [1, 0.16, 0.24]);
    const b = corDoTema("--neon2-rgb", [0.69, 0, 0.1]);
    const brilho = Number(getComputedStyle(document.documentElement).getPropertyValue("--brilho")) || 0.7;

    // resolução: nítida na abertura, menor no fundo (que é só ambiente)
    let fator = 1; // resolução dinâmica: se o aparelho não dá conta, o vórtice desenha menor em vez de engasgar
    const ajusta = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const alvo = (fundo ? 0.45 : 0.9) * fator;
      let w = Math.max(2, Math.round(canvas.clientWidth * dpr * alvo)), h = Math.max(2, Math.round(canvas.clientHeight * dpr * alvo));
      const max = fundo ? 500_000 : 1_600_000;
      if (w * h > max) { const k = Math.sqrt(max / (w * h)); w = Math.round(w * k); h = Math.round(h * k); }
      if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; gl.viewport(0, 0, w, h); }
    };
    ajusta();
    window.addEventListener("resize", ajusta);

    let quadro = 0, anterior = 0, pos = 0, relogio = 0, ultimoDesenho = 0, vivo = true, inicio = 0, amostra = 0, somaDt = 0;
    const desenha = (agora: number) => {
      if (!vivo) return;
      quadro = requestAnimationFrame(desenha);
      if (document.hidden) { anterior = agora; return; }
      if (!inicio) inicio = agora;
      if (!fundo && anterior) {
        somaDt += agora - anterior;
        if (++amostra === 12) {
          if (somaDt / 12 > 24 && fator > 0.45) { fator *= 0.78; ajusta(); }
          amostra = 0; somaDt = 0;
        }
      }
      if (fundo && agora - ultimoDesenho < 33) return; // 30 quadros por segundo bastam para o fundo
      ultimoDesenho = agora;
      const dt = anterior ? Math.min(0.1, (agora - anterior) / 1000) : 0.016;
      anterior = agora;
      // na abertura o relógio é o tempo real: se algum quadro demorar, a animação não atrasa em relação ao nome que surge
      relogio = fundo ? relogio + dt : (agora - inicio) / 1000;
      let flash = 0;
      if (fundo) pos += dt * 0.16;
      else {
        const s = Math.min(1, relogio / 3.1);
        pos += dt * (0.5 + 4.2 * s * s);             // acelera até ser puxado para dentro
        flash = Math.max(0, Math.min(1, (relogio - 2.55) / 0.55)) * 0.9;
      }
      gl.uniform2f(uRes, canvas.width, canvas.height);
      gl.uniform1f(uT, relogio);
      gl.uniform1f(uPos, pos);
      gl.uniform3f(uA, a[0], a[1], a[2]);
      gl.uniform3f(uB, b[0], b[1], b[2]);
      gl.uniform1f(uBrilho, 0.65 + brilho * 0.9);
      gl.uniform1f(uFundo, fundo ? 1 : 0);
      gl.uniform1f(uFlash, flash);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };
    quadro = requestAnimationFrame(desenha);
    return () => { vivo = false; cancelAnimationFrame(quadro); window.removeEventListener("resize", ajusta); gl.getExtension("WEBGL_lose_context")?.loseContext(); };
  }, [modo]);
  return <canvas ref={tela} className="vortice" aria-hidden />;
}

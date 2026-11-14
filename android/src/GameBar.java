package tech.vetorial.vortex;

import android.app.Activity;
import android.app.ActivityManager;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.os.BatteryManager;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.os.Process;
import android.util.TypedValue;
import android.view.Choreographer;
import android.view.Display;
import android.view.Gravity;
import android.view.View;
import android.view.WindowManager;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.TextView;

import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.FileReader;
import java.util.Arrays;
import java.util.List;
import java.util.Locale;

/** Game Bar: barra de status por cima do jogo (FPS da tela, CPU do Vortex, GPU quando o aparelho deixa ler, RAM, temperatura, bateria) com troca de modo Turbo / Normal / Econômico.
 *  Posição: topo, base, esquerda, direita ou oculta (uma alça na borda que mostra a barra por alguns segundos). A configuração fica no aparelho e é editada nos Ajustes do Vortex. */
public final class GameBar {
    static final String PREFS = "vortex_gamebar";
    static final List<String> POSICOES = Arrays.asList("topo", "base", "esquerda", "direita", "oculta");
    static final List<String> MODOS = Arrays.asList("economico", "normal", "turbo");
    static final String[] ITENS = {"fps", "cpu", "gpu", "ram", "temp", "bateria", "ping"};

    public static JSONObject ler(Context c) throws Exception {
        SharedPreferences p = c.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        JSONObject o = new JSONObject().put("ligada", p.getBoolean("ligada", true)).put("posicao", p.getString("posicao", "topo")).put("modo", p.getString("modo", "normal")).put("taxa", p.getInt("taxa", 0));
        for (String i : ITENS) o.put(i, p.getBoolean(i, true));
        return o;
    }

    /** Grava só o que veio e é válido; devolve a configuração completa. */
    public static JSONObject gravar(Context c, JSONObject n) throws Exception {
        SharedPreferences.Editor e = c.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit();
        if (n.has("ligada")) e.putBoolean("ligada", n.getBoolean("ligada"));
        if (n.has("posicao") && POSICOES.contains(n.getString("posicao"))) e.putString("posicao", n.getString("posicao"));
        if (n.has("modo") && MODOS.contains(n.getString("modo"))) e.putString("modo", n.getString("modo"));
        if (n.has("taxa")) { int t = n.getInt("taxa"); e.putInt("taxa", t >= 24 && t <= 240 ? t : 0); }
        for (String i : ITENS) if (n.has(i)) e.putBoolean(i, n.getBoolean(i));
        e.apply();
        return ler(c);
    }

    private final Activity act;
    private final FrameLayout raiz;
    private final Handler h = new Handler(Looper.getMainLooper());
    private LinearLayout barra, modos;
    private android.widget.ScrollView rolagem;
    private TextView texto;
    private View alca;
    private JSONObject cfg;
    private boolean rodando, expandida;
    private int frames, fps;
    private long ultFps, ultCpuMs, ultCpuTicks = -1;
    private int cpu = -1;
    // FPS real do jogo: quadros novos que o núcleo entregou (contador do motor de vídeo remendado), contra o FPS da tela
    private long ultQuadrosJogo = -1, ultQuadrosEm;
    private int fpsJogo = -1;
    private volatile int pingMs = -1;
    private long ultPing;
    private String modoAtual = "normal";

    private final Choreographer.FrameCallback quadro = new Choreographer.FrameCallback() {
        @Override public void doFrame(long t) { frames++; if (rodando) Choreographer.getInstance().postFrameCallback(this); }
    };
    private final Runnable volta = new Runnable() { @Override public void run() { atualizar(); if (rodando) h.postDelayed(this, 1000); } };
    private final Runnable esconder = new Runnable() { @Override public void run() { expandida = false; desenhar(); } };

    /** Quem troca a velocidade do jogo de verdade (a tela do jogo). Valores inteiros: 1 = normal, 2 = dobro... */
    public interface AoTrocarVelocidade { boolean definir(int x); }
    public AoTrocarVelocidade aoTrocarVelocidade;
    private int velocidade = 1;
    public interface AoTrocarTamanho { void definir(int pct); }
    public interface AoTrocar { void definir(int valor); }
    public AoTrocar aoTrocarFormato, aoTrocarQualidade, aoTrocarCorrecao;
    public int formatoAtual = 0, qualidadeAtual = 0, correcaoAtual = 0;
    public AoTrocarTamanho aoTrocarTamanho;
    public int tamanhoAtual = 100;

    public GameBar(Activity a, FrameLayout raiz) { this.act = a; this.raiz = raiz; }

    private int dp(float v) { return (int) TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, v, act.getResources().getDisplayMetrics()); }

    public void iniciar() {
        try { cfg = ler(act); } catch (Exception e) { cfg = new JSONObject(); }
        modoAtual = cfg.optString("modo", "normal");
        aplicarModo(modoAtual);
        desenhar();
        if (!cfg.optBoolean("ligada", true) || rodando) return;
        rodando = true;
        frames = 0; ultFps = System.nanoTime();
        Choreographer.getInstance().postFrameCallback(quadro);
        h.postDelayed(volta, 1000);
    }

    public void parar() {
        rodando = false;
        h.removeCallbacks(volta); h.removeCallbacks(esconder);
    }

    /** Relê a configuração (depois de voltar dos Ajustes) e redesenha. */
    public void recarregar() { parar(); iniciar(); }

    private void desenhar() {
        if (rolagem != null) { raiz.removeView(rolagem); rolagem = null; }
        if (barra != null) raiz.removeView(barra);
        if (alca != null) raiz.removeView(alca);
        barra = null; alca = null;
        if (!cfg.optBoolean("ligada", true)) return;
        String pos = cfg.optString("posicao", "topo");
        boolean vertical = pos.equals("esquerda") || pos.equals("direita");
        if (pos.equals("oculta") && !expandida) {
            alca = new View(act);
            GradientDrawable g = new GradientDrawable();
            g.setCornerRadius(dp(4)); g.setColor(Color.argb(150, 25, 227, 255));
            alca.setBackground(g);
            alca.setOnClickListener(new View.OnClickListener() { public void onClick(View v) { expandida = true; desenhar(); h.removeCallbacks(esconder); h.postDelayed(esconder, 6000); } });
            raiz.addView(alca, new FrameLayout.LayoutParams(dp(56), dp(8), Gravity.TOP | Gravity.CENTER_HORIZONTAL));
            return;
        }
        barra = new LinearLayout(act);
        barra.setOrientation(LinearLayout.VERTICAL);
        barra.setPadding(dp(10), dp(6), dp(10), dp(6));
        GradientDrawable fundo = new GradientDrawable();
        fundo.setCornerRadius(dp(12)); fundo.setColor(Color.argb(170, 8, 6, 14)); fundo.setStroke(dp(1), Color.argb(190, 255, 42, 61));
        barra.setBackground(fundo);
        texto = new TextView(act);
        texto.setTextColor(Color.WHITE); texto.setTextSize(11); texto.setTypeface(Typeface.MONOSPACE, Typeface.BOLD);
        barra.addView(texto);
        barra.setOnClickListener(new View.OnClickListener() { public void onClick(View v) { expandida = !expandida; desenhar(); h.removeCallbacks(esconder); if (cfg.optString("posicao", "topo").equals("oculta") && expandida) h.postDelayed(esconder, 6000); } });
        if (expandida) {
            barra.setMinimumWidth(dp(250));
            barra.setPadding(dp(12), dp(8), dp(12), dp(10));
            texto.setTextSize(14);
            barra.addView(titulo("TAXA DA TELA (FPS)"));
            LinearLayout taxas = new LinearLayout(act);
            taxas.setOrientation(LinearLayout.HORIZONTAL);
            taxas.addView(botaoTaxa("Auto", 0));
            for (int t : taxasDaTela()) taxas.addView(botaoTaxa(t + " Hz", t));
            barra.addView(taxas);
            if (aoTrocarVelocidade != null) {
                barra.addView(titulo("VELOCIDADE DO JOGO"));
                LinearLayout vel = new LinearLayout(act);
                vel.setOrientation(LinearLayout.HORIZONTAL);
                for (int x = 1; x <= 4; x++) vel.addView(botaoVelocidade(x));
                barra.addView(vel);
            }
            if (aoTrocarFormato != null) {
                barra.addView(titulo("FORMATO DA TELA"));
                LinearLayout fm = new LinearLayout(act);
                fm.setOrientation(LinearLayout.HORIZONTAL);
                fm.addView(botaoOpcao("Original", formatoAtual == 0, 0, 0));
                fm.addView(botaoOpcao("Ampliado", formatoAtual == 1, 1, 0));
                fm.addView(botaoOpcao("Tela cheia", formatoAtual == 2, 2, 0));
                barra.addView(fm);
            }
            if (aoTrocarQualidade != null) {
                barra.addView(titulo("QUALIDADE DA IMAGEM"));
                LinearLayout ql = new LinearLayout(act);
                ql.setOrientation(LinearLayout.HORIZONTAL);
                ql.addView(botaoOpcao("Padrão", qualidadeAtual == 0, 0, 1));
                ql.addView(botaoOpcao("Alta", qualidadeAtual == 1, 1, 1));
                ql.addView(botaoOpcao("Máxima", qualidadeAtual == 2, 2, 1));
                barra.addView(ql);
            }
            if (aoTrocarCorrecao != null) {
                barra.addView(titulo("CORES QUEBRADAS? TESTE 1 A 4"));
                LinearLayout cr = new LinearLayout(act);
                cr.setOrientation(LinearLayout.HORIZONTAL);
                for (int c = 0; c < 4; c++) cr.addView(botaoOpcao(String.valueOf(c + 1), correcaoAtual == c, c, 2));
                barra.addView(cr);
            }
            if (aoTrocarTamanho != null) {
                barra.addView(titulo("TAMANHO DA TELA"));
                LinearLayout tam = new LinearLayout(act);
                tam.setOrientation(LinearLayout.HORIZONTAL);
                int[] pcts = {70, 85, 100, 115, 130, 150};
                for (int p : pcts) tam.addView(botaoTamanho(p));
                barra.addView(tam);
            }
            barra.addView(titulo("MODO DE JOGO"));
            modos = new LinearLayout(act);
            modos.setOrientation(LinearLayout.HORIZONTAL);
            modos.addView(botaoModo("⚡ Turbo", "turbo"));
            modos.addView(botaoModo("● Normal", "normal"));
            modos.addView(botaoModo("🍃 Econômico", "economico"));
            barra.addView(modos);
        }
        int grav; int mx = 0, my = 0;
        switch (pos) {
            case "base": grav = Gravity.BOTTOM | Gravity.CENTER_HORIZONTAL; my = 60; break;
            case "esquerda": grav = Gravity.START | Gravity.CENTER_VERTICAL; mx = 6; break;
            case "direita": grav = Gravity.END | Gravity.CENTER_VERTICAL; mx = 6; break;
            case "oculta": grav = Gravity.TOP | Gravity.CENTER_HORIZONTAL; my = 6; break;
            default: grav = Gravity.TOP | Gravity.START; mx = 80; my = 6; break; // depois do botão L da tela
        }
        FrameLayout.LayoutParams lp = new FrameLayout.LayoutParams(-2, -2, grav);
        lp.setMargins(dp(mx), dp(my), dp(mx), dp(my));
        if (expandida) {
            // com tantas opções o painel passa da altura da tela: ele rola dentro de uma moldura que cabe na tela
            rolagem = new android.widget.ScrollView(act);
            rolagem.addView(barra);
            lp.height = Math.max(dp(160), act.getResources().getDisplayMetrics().heightPixels - dp(my * 2 + 16));
            raiz.addView(rolagem, lp);
        } else raiz.addView(barra, lp);
        atualizar();
    }

    private TextView titulo(String rotulo) {
        TextView t = new TextView(act);
        t.setText(rotulo); t.setTextSize(9); t.setTextColor(Color.argb(200, 255, 140, 150)); t.setTypeface(Typeface.DEFAULT_BOLD);
        t.setLetterSpacing(0.12f);
        t.setPadding(dp(2), dp(10), 0, dp(2));
        return t;
    }

    /** Taxas de atualização que a tela do aparelho aceita na resolução atual (ex.: 60, 90, 120). */
    private List<Integer> taxasDaTela() {
        java.util.TreeSet<Integer> r = new java.util.TreeSet<Integer>();
        try {
            if (Build.VERSION.SDK_INT >= 23) {
                Display d = act.getWindowManager().getDefaultDisplay();
                Display.Mode atual = d.getMode();
                for (Display.Mode m : d.getSupportedModes()) {
                    if (m.getPhysicalWidth() != atual.getPhysicalWidth() || m.getPhysicalHeight() != atual.getPhysicalHeight()) continue;
                    r.add(Math.round(m.getRefreshRate()));
                }
            }
        } catch (Throwable ignora) { }
        if (r.isEmpty()) r.add(60);
        return new java.util.ArrayList<Integer>(r);
    }

    private TextView botaoVelocidade(final int x) {
        TextView t = botaoModo("x" + x, "");
        boolean ativa = velocidade == x;
        GradientDrawable g = new GradientDrawable();
        g.setCornerRadius(dp(8));
        g.setColor(ativa ? Color.argb(230, 255, 190, 40) : Color.argb(90, 255, 255, 255));
        t.setBackground(g);
        t.setTextColor(ativa ? Color.BLACK : Color.WHITE);
        t.setOnClickListener(new View.OnClickListener() { public void onClick(View v) {
            if (aoTrocarVelocidade != null && aoTrocarVelocidade.definir(x)) velocidade = x;
            else android.widget.Toast.makeText(act, "Este jogo não aceitou trocar a velocidade.", android.widget.Toast.LENGTH_SHORT).show();
            desenhar();
        } });
        return t;
    }

    private TextView botaoOpcao(String rotulo, boolean ativa, final int valor, final int tipo) {
        TextView t = botaoModo(rotulo, "");
        GradientDrawable g = new GradientDrawable();
        g.setCornerRadius(dp(8));
        g.setColor(ativa ? Color.argb(230, 25, 227, 255) : Color.argb(90, 255, 255, 255));
        t.setBackground(g);
        t.setTextColor(ativa ? Color.BLACK : Color.WHITE);
        t.setOnClickListener(new View.OnClickListener() { public void onClick(View v) {
            if (tipo == 0) { formatoAtual = valor; if (aoTrocarFormato != null) aoTrocarFormato.definir(valor); }
            else if (tipo == 1) { qualidadeAtual = valor; if (aoTrocarQualidade != null) aoTrocarQualidade.definir(valor); }
            else { correcaoAtual = valor; if (aoTrocarCorrecao != null) aoTrocarCorrecao.definir(valor); }
            desenhar();
        } });
        return t;
    }

    private TextView botaoTamanho(final int pct) {
        TextView t = botaoModo(pct + "%", "");
        boolean ativa = tamanhoAtual == pct;
        GradientDrawable g = new GradientDrawable();
        g.setCornerRadius(dp(8));
        g.setColor(ativa ? Color.argb(230, 25, 227, 255) : Color.argb(90, 255, 255, 255));
        t.setBackground(g);
        t.setTextColor(ativa ? Color.BLACK : Color.WHITE);
        t.setOnClickListener(new View.OnClickListener() { public void onClick(View v) {
            tamanhoAtual = pct;
            if (aoTrocarTamanho != null) aoTrocarTamanho.definir(pct);
            desenhar();
        } });
        return t;
    }

    private TextView botaoTaxa(String rotulo, final int taxa) {
        TextView t = botaoModo(rotulo, "");
        boolean ativa = cfg.optInt("taxa", 0) == taxa;
        GradientDrawable g = new GradientDrawable();
        g.setCornerRadius(dp(8));
        g.setColor(ativa ? Color.argb(230, 25, 227, 255) : Color.argb(90, 255, 255, 255));
        t.setBackground(g);
        t.setTextColor(ativa ? Color.BLACK : Color.WHITE);
        t.setOnClickListener(new View.OnClickListener() { public void onClick(View v) {
            try { cfg.put("taxa", taxa); JSONObject n = new JSONObject(); n.put("taxa", taxa); gravar(act, n); } catch (Exception ignora) { }
            aplicarModo(modoAtual);
            frames = 0; ultFps = System.nanoTime();
            desenhar();
        } });
        return t;
    }

    private TextView botaoModo(String rotulo, final String modo) {
        TextView t = new TextView(act);
        t.setText(rotulo); t.setTextSize(11); t.setTextColor(Color.WHITE); t.setTypeface(Typeface.DEFAULT_BOLD);
        t.setPadding(dp(10), dp(6), dp(10), dp(6));
        GradientDrawable g = new GradientDrawable();
        g.setCornerRadius(dp(8));
        g.setColor(modo.equals(modoAtual) ? Color.argb(230, 255, 42, 61) : Color.argb(90, 255, 255, 255));
        t.setBackground(g);
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(-2, -2);
        lp.setMargins(dp(2), dp(2), dp(2), dp(2));
        t.setLayoutParams(lp);
        t.setOnClickListener(new View.OnClickListener() { public void onClick(View v) {
            modoAtual = modo; try { cfg.put("modo", modo); } catch (Exception ignora) { } aplicarModo(modo);
            try { JSONObject n = new JSONObject(); n.put("modo", modo); gravar(act, n); } catch (Exception ignora) { }
            desenhar();
        } });
        return t;
    }

    /** Turbo: taxa de atualização máxima da tela e prioridade alta. Econômico: tela a 60 Hz e brilho mais baixo. Normal: o padrão do sistema. */
    void aplicarModo(String modo) {
        try {
            WindowManager.LayoutParams lp = act.getWindow().getAttributes();
            lp.screenBrightness = modo.equals("economico") ? 0.35f : WindowManager.LayoutParams.BRIGHTNESS_OVERRIDE_NONE;
            if (Build.VERSION.SDK_INT >= 23) {
                Display d = act.getWindowManager().getDefaultDisplay();
                Display.Mode atual = d.getMode();
                int alvo = 0; float melhor = -1;
                for (Display.Mode m : d.getSupportedModes()) {
                    if (m.getPhysicalWidth() != atual.getPhysicalWidth() || m.getPhysicalHeight() != atual.getPhysicalHeight()) continue;
                    float r = m.getRefreshRate();
                    if (modo.equals("turbo") && r > melhor) { melhor = r; alvo = m.getModeId(); }
                    else if (modo.equals("economico") && r >= 59f && (melhor < 0 || r < melhor)) { melhor = r; alvo = m.getModeId(); }
                }
                lp.preferredDisplayModeId = modo.equals("normal") ? 0 : alvo;
                int taxa = cfg == null ? 0 : cfg.optInt("taxa", 0);
                if (taxa > 0) {
                    for (Display.Mode m : d.getSupportedModes()) {
                        if (m.getPhysicalWidth() != atual.getPhysicalWidth() || m.getPhysicalHeight() != atual.getPhysicalHeight()) continue;
                        if (Math.round(m.getRefreshRate()) == taxa) { lp.preferredDisplayModeId = m.getModeId(); break; }
                    }
                    lp.preferredRefreshRate = taxa;
                }
            }
            act.getWindow().setAttributes(lp);
            Process.setThreadPriority(modo.equals("turbo") ? Process.THREAD_PRIORITY_URGENT_DISPLAY : Process.THREAD_PRIORITY_DEFAULT);
        } catch (Throwable ignora) { }
    }

    private long ticksProprios() {
        try (BufferedReader r = new BufferedReader(new FileReader("/proc/self/stat"))) {
            String l = r.readLine();
            String[] p = l.substring(l.lastIndexOf(')') + 2).split(" ");
            return Long.parseLong(p[11]) + Long.parseLong(p[12]);
        } catch (Throwable e) { return -1; }
    }

    private int lerGpu() {
        try (BufferedReader r = new BufferedReader(new FileReader("/sys/class/kgsl/kgsl-3d0/gpu_busy_percentage"))) {
            return Integer.parseInt(r.readLine().replaceAll("[^0-9]", ""));
        } catch (Throwable e) { return -1; }
    }

    private void atualizar() {
        if (texto == null) return;
        long agora = System.nanoTime();
        if (agora - ultFps >= 900_000_000L) { fps = Math.round(frames * 1e9f / (agora - ultFps)); frames = 0; ultFps = agora; }
        long totalJogo = quadrosDoJogo();
        if (totalJogo >= 0) {
            if (ultQuadrosJogo >= 0 && agora - ultQuadrosEm >= 900_000_000L) { fpsJogo = Math.round((totalJogo - ultQuadrosJogo) * 1e9f / (agora - ultQuadrosEm)); ultQuadrosJogo = totalJogo; ultQuadrosEm = agora; }
            else if (ultQuadrosJogo < 0) { ultQuadrosJogo = totalJogo; ultQuadrosEm = agora; }
        }
        if (cfg.optBoolean("ping", true) && System.currentTimeMillis() - ultPing > 5000) { ultPing = System.currentTimeMillis(); medirPing(); }
        long ms = System.currentTimeMillis(), t = ticksProprios();
        if (t >= 0 && ultCpuTicks >= 0 && ms > ultCpuMs) {
            long tck = 100;
            try { tck = android.system.Os.sysconf(android.system.OsConstants._SC_CLK_TCK); } catch (Throwable ignora) { }
            cpu = (int) Math.min(100, Math.round((t - ultCpuTicks) * 1000.0 / ((ms - ultCpuMs) * (double) tck * Runtime.getRuntime().availableProcessors()) * 100));
        }
        ultCpuTicks = t; ultCpuMs = ms;
        StringBuilder s = new StringBuilder();
        String sep = cfg.optString("posicao", "topo").equals("esquerda") || cfg.optString("posicao", "topo").equals("direita") ? "\n" : "  ";
        if (cfg.optBoolean("fps", true)) {
            if (fpsJogo >= 0) s.append("FPS ").append(fpsJogo).append(" (tela ").append(fps).append(")").append(sep);
            else s.append("FPS ").append(fps).append(sep);
        }
        if (cfg.optBoolean("cpu", true) && cpu >= 0) s.append("CPU ").append(cpu).append("%").append(sep);
        if (cfg.optBoolean("gpu", true)) { int g = lerGpu(); if (g >= 0) s.append("GPU ").append(g).append("%").append(sep); }
        if (cfg.optBoolean("ram", true)) {
            ActivityManager.MemoryInfo mi = new ActivityManager.MemoryInfo();
            ((ActivityManager) act.getSystemService(Context.ACTIVITY_SERVICE)).getMemoryInfo(mi);
            if (mi.totalMem > 0) s.append("RAM ").append(100 - mi.availMem * 100 / mi.totalMem).append("%").append(sep);
        }
        if (cfg.optBoolean("ping", true) && pingMs >= 0) s.append("PING ").append(pingMs).append("ms").append(sep);
        Intent b = act.registerReceiver(null, new IntentFilter(Intent.ACTION_BATTERY_CHANGED));
        if (b != null) {
            if (cfg.optBoolean("temp", true)) s.append(String.format(Locale.US, "%.0f°C", b.getIntExtra(BatteryManager.EXTRA_TEMPERATURE, 0) / 10f)).append(sep);
            int esc = b.getIntExtra(BatteryManager.EXTRA_SCALE, 100);
            if (cfg.optBoolean("bateria", true) && esc > 0) s.append("BAT ").append(b.getIntExtra(BatteryManager.EXTRA_LEVEL, 0) * 100 / esc).append("%");
        }
        texto.setText(s.toString().trim());
    }

    /** Quadros novos entregues pelo núcleo do jogo desde o começo (-1 quando o motor não tem o contador). */
    private static long quadrosDoJogo() {
        try { return (Long) Class.forName("com.swordfish.libretrodroid.LibretroDroid").getMethod("vortexQuadros").invoke(null); }
        catch (Throwable e) { return -1; }
    }

    /** Tempo de uma conexão TCP até o DNS da Cloudflare, medido fora da tela principal. */
    private void medirPing() {
        new Thread(new Runnable() {
            @Override public void run() {
                long t0 = System.nanoTime();
                try (java.net.Socket so = new java.net.Socket()) {
                    so.connect(new java.net.InetSocketAddress("1.1.1.1", 53), 1500);
                    pingMs = (int) ((System.nanoTime() - t0) / 1_000_000L);
                } catch (Exception e) { pingMs = -1; }
            }
        }, "vortex-ping").start();
    }
}

package tech.vetorial.vortex;

import android.content.Context;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.os.Bundle;
import android.util.TypedValue;
import android.hardware.input.InputManager;
import android.view.Gravity;
import android.view.InputDevice;
import android.view.KeyEvent;
import android.view.MotionEvent;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowManager;
import android.widget.Button;
import android.widget.Toast;
import android.widget.FrameLayout;

import androidx.appcompat.app.AppCompatActivity;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;

import com.swordfish.libretrodroid.GLRetroView;
import com.swordfish.libretrodroid.GLRetroViewData;

import java.io.File;
import java.io.FileOutputStream;
import java.nio.file.Files;

/** Tela do jogo: o próprio Vortex roda o núcleo (LibretroDroid), com controle físico ou botões na tela. Guarda o save (SRAM) ao sair. */
public class JogoActivity extends AppCompatActivity {
    private GLRetroView retro;
    private File srm;
    private FrameLayout raiz;
    private View controles;
    private GameBar gameBar;
    private boolean controleDetectado;
    private InputManager.InputDeviceListener ouvinte;
    private String jogoId = "jogo";

    @Override
    protected void onCreate(Bundle b) {
        super.onCreate(b);
        String rom = getIntent().getStringExtra("rom");
        String nucleo = getIntent().getStringExtra("nucleo");
        String id = getIntent().getStringExtra("id");
        File savesDir = new File(getFilesDir(), "saves");
        savesDir.mkdirs();
        jogoId = id == null ? "jogo" : id.replaceAll("[^A-Za-z0-9_.-]", "_");
        srm = new File(savesDir, (id == null ? "jogo" : id) + ".srm");

        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
        WindowInsetsControllerCompat c = WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView());
        c.hide(WindowInsetsCompat.Type.systemBars());
        c.setSystemBarsBehavior(WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);

        GLRetroViewData dados = new GLRetroViewData(this);
        dados.setCoreFilePath(NucleosAndroid.arquivo(this, nucleo).getAbsolutePath());
        dados.setGameFilePath(rom);
        dados.setSystemDirectory(new File(getFilesDir(), "system").getAbsolutePath());
        dados.setSavesDirectory(savesDir.getAbsolutePath());
        new File(dados.getSystemDirectory()).mkdirs();
        nucleoAtual = nucleo == null ? "" : nucleo;
        String platExtra = getIntent().getStringExtra("plataforma");
        plataforma = platExtra == null ? "" : platExtra;
        // modo de teste do GameCube/Wii: desenho por software (lento, mas mostra se o problema é a placa de vídeo)
        if (nucleoAtual.startsWith("dolphin")) { ajustesDeImagemDolphin(dados); definirVariaveis(dados, juntar(variaveisDeQualidade(qualidadeDaImagem()), variaveisDeCorrecao(correcaoDeCores()))); }
        if (getIntent().getBooleanExtra("software", false) && nucleoAtual.startsWith("dolphin")) definirVariavel(dados, "dolphin_renderer", "Software");
        try { if (srm.isFile()) dados.setSaveRAMState(Files.readAllBytes(srm.toPath())); } catch (Exception ignora) { }

        retro = new GLRetroView(this, dados);
        getLifecycle().addObserver(retro);
        raiz = new FrameLayout(this);
        raiz.setBackgroundColor(Color.BLACK);
        raiz.addView(retro, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        controles = montarControles();
        raiz.addView(controles);
        setContentView(raiz);
        if (nucleoAtual.startsWith("dolphin")) travarEm60Hz();
        // só depois que o motor subiu (antes disso ele ainda não existe)
        retro.postDelayed(new Runnable() { public void run() {
            aplicarTamanhoDaTela(tamanhoDaTela());
            aplicarFormatoDaTela(formatoDaTela());
            if (nucleoAtual.startsWith("dolphin") && qualidadeDaImagem() >= 1) aplicarQualidadeAoVivo(qualidadeDaImagem());
            if (nucleoAtual.startsWith("dolphin")) { try { retro.setControllerType(0, 1); } catch (Throwable ignora) { } }
        } }, 2500);
        retro.setFocusable(true);
        retro.requestFocus();
        atualizarControles();
        // controle ligado ou desligado com o jogo aberto: os botões da tela somem e voltam sozinhos
        ouvinte = new InputManager.InputDeviceListener() {
            public void onInputDeviceAdded(int i) { atualizarControles(); }
            public void onInputDeviceRemoved(int i) { controleDetectado = false; atualizarControles(); }
            public void onInputDeviceChanged(int i) { atualizarControles(); }
        };
        ((InputManager) getSystemService(Context.INPUT_SERVICE)).registerInputDeviceListener(ouvinte, null);
        gameBar = new GameBar(this, raiz);
        gameBar.aoTrocarVelocidade = new GameBar.AoTrocarVelocidade() {
            public boolean definir(int x) {
                try { retro.getClass().getMethod("setFrameSpeed", int.class).invoke(retro, x); return true; } catch (Throwable e) { return false; }
            }
        };
        gameBar.tamanhoAtual = tamanhoDaTela();
        gameBar.aoTrocarTamanho = new GameBar.AoTrocarTamanho() {
            public void definir(int pct) {
                getSharedPreferences("vortex_visual", MODE_PRIVATE).edit().putInt("tela_pct", pct).apply();
                aplicarTamanhoDaTela(pct);
            }
        };
        gameBar.formatoAtual = formatoDaTela();
        gameBar.aoTrocarFormato = new GameBar.AoTrocar() {
            public void definir(int f) {
                getSharedPreferences("vortex_visual", MODE_PRIVATE).edit().putInt("formato", f).apply();
                aplicarFormatoDaTela(f);
            }
        };
        if (nucleoAtual.startsWith("dolphin")) {
            gameBar.correcaoAtual = correcaoDeCores();
            gameBar.aoTrocarCorrecao = new GameBar.AoTrocar() {
                public void definir(int c) {
                    getSharedPreferences("vortex_visual", MODE_PRIVATE).edit().putInt("correcao", c).apply();
                    aplicarVariaveisAoVivo(juntar(variaveisDeQualidade(qualidadeDaImagem()), variaveisDeCorrecao(c)), true);
                }
            };
            gameBar.qualidadeAtual = qualidadeDaImagem();
            gameBar.aoTrocarQualidade = new GameBar.AoTrocar() {
                public void definir(int q) {
                    getSharedPreferences("vortex_visual", MODE_PRIVATE).edit().putInt("qualidade", q).apply();
                    aplicarQualidadeAoVivo(q);
                }
            };
        }
        ligarEstadosEFoto();
        if (!nucleoAtual.startsWith("dolphin")) {
            gameBar.filtroAtual = filtroDaImagem();
            gameBar.aoTrocarFiltro = new GameBar.AoTrocar() {
                public void definir(int f) {
                    getSharedPreferences("vortex_visual", MODE_PRIVATE).edit().putInt("filtro", f).apply();
                    aplicarFiltroAoVivo(f, true);
                }
            };
            if (filtroDaImagem() != 0) retro.postDelayed(new Runnable() { public void run() { aplicarFiltroAoVivo(filtroDaImagem(), false); } }, 2600);
        }
        gameBar.iniciar();
        if (nucleoAtual.startsWith("dolphin")) mostrarBotaoDiagnostico();
    }

    private int tamanhoDaTela() { return getSharedPreferences("vortex_visual", MODE_PRIVATE).getInt("tela_pct", 100); }

    /** Aumenta ou diminui a imagem do jogo (em %, a partir do centro, sem deformar). Acima de 100 as bordas saem da tela. */
    private void aplicarTamanhoDaTela(int pct) {
        if (retro == null) return;
        float h = Math.max(50, Math.min(200, pct)) / 200f;
        try { retro.setViewport(new android.graphics.RectF(0.5f - h, 0.5f - h, 0.5f + h, 0.5f + h)); } catch (Throwable ignora) { }
    }


    // ---------------------------------------------------------------- formato da tela e qualidade da imagem

    private int formatoDaTela() { return getSharedPreferences("vortex_visual", MODE_PRIVATE).getInt("formato", 0); }
    private int qualidadeDaImagem() { return getSharedPreferences("vortex_visual", MODE_PRIVATE).getInt("qualidade", 0); }

    /** Proporção da imagem original de cada sistema (largura / altura). */
    private float proporcaoDoJogo() {
        String n = nucleoAtual;
        if (n.startsWith("ppsspp")) return 16f / 9f;
        if (n.startsWith("mgba") || n.startsWith("gpsp") || n.startsWith("vba")) return 3f / 2f;
        if (n.startsWith("gambatte") || n.startsWith("sameboy")) return 10f / 9f;
        return 4f / 3f;
    }

    /** 0 = original (barras pretas dos lados), 1 = ampliado (estica metade), 2 = tela cheia (preenche tudo, esticando a imagem). */
    private void aplicarFormatoDaTela(int f) {
        if (retro == null) return;
        final int w0 = retro.getWidth(), h0 = retro.getHeight();
        final int largura = w0 > 0 ? w0 : getResources().getDisplayMetrics().widthPixels;
        final int altura = h0 > 0 ? h0 : getResources().getDisplayMetrics().heightPixels;
        final float tela = (float) largura / altura, jogo = proporcaoDoJogo();
        try {
            if (f <= 0 || tela <= jogo) { retro.getHolder().setSizeFromLayout(); return; }
            float parte = f == 1 ? 0.5f : 1f;
            float alvo = jogo + parte * (tela - jogo);
            // o desenho do jogo continua sem deformar dentro dessa área; o Android é quem estica a área até a tela
            retro.getHolder().setFixedSize(Math.round(altura * alvo), altura);
        } catch (Throwable ignora) { }
    }

    /** GameCube/Wii: Padrão = como estava; Alta e Máxima aumentam a resolução interna e a nitidez das texturas (pedem mais do aparelho). */
    private static String[][] variaveisDeQualidade(int q) {
        if (q >= 2) return new String[][] { { "dolphin_efb_scale", "x3 (1920 x 1584)" }, { "dolphin_max_anisotropy", "16x" } };
        if (q == 1) return new String[][] { { "dolphin_efb_scale", "x2 (1280 x 1056)" }, { "dolphin_max_anisotropy", "4x" } };
        return new String[][] { { "dolphin_efb_scale", "x1 (640 x 528)" }, { "dolphin_max_anisotropy", "1x" } };
    }

    /** Correção das cores quebradas (manchas amarelas, vermelhas e azuis): cada modo muda um jeito de o núcleo montar as texturas. */
    private static String[][] variaveisDeCorrecao(int c) {
        switch (c) {
            case 1: return new String[][] { { "dolphin_texture_cache_accuracy", "Safe" }, { "dolphin_gpu_texture_decoding", "ON" }, { "dolphin_efb_to_texture", "ON" } };
            case 2: return new String[][] { { "dolphin_texture_cache_accuracy", "Safe" }, { "dolphin_gpu_texture_decoding", "OFF" }, { "dolphin_efb_to_texture", "OFF" } };
            case 3: return new String[][] { { "dolphin_texture_cache_accuracy", "Safe" }, { "dolphin_gpu_texture_decoding", "ON" }, { "dolphin_efb_to_texture", "OFF" }, { "dolphin_efb_scaled_copy", "OFF" } };
            default: return new String[][] { { "dolphin_texture_cache_accuracy", "Safe" }, { "dolphin_gpu_texture_decoding", "OFF" }, { "dolphin_efb_to_texture", "ON" } };
        }
    }

    private static String[][] juntar(String[][] a, String[][] b) {
        String[][] r = new String[a.length + b.length][];
        System.arraycopy(a, 0, r, 0, a.length);
        System.arraycopy(b, 0, r, a.length, b.length);
        return r;
    }

    private int correcaoDeCores() { return getSharedPreferences("vortex_visual", MODE_PRIVATE).getInt("correcao", 0); }

    private static void definirVariaveis(GLRetroViewData dados, String[][] pares) {
        try {
            Class<?> k = Class.forName("com.swordfish.libretrodroid.Variable");
            Object arr = java.lang.reflect.Array.newInstance(k, pares.length);
            for (int i = 0; i < pares.length; i++) java.lang.reflect.Array.set(arr, i, k.getConstructor(String.class, String.class).newInstance(pares[i][0], pares[i][1]));
            dados.getClass().getMethod("setVariables", arr.getClass()).invoke(dados, arr);
        } catch (Throwable ignora) { }
    }

    /** Manda as opções ao núcleo com o jogo aberto e (se pedido) mostra o que ele passou a usar, para a pessoa saber que pegou. */
    private void aplicarVariaveisAoVivo(String[][] pares, boolean mostrar) {
        try {
            Class<?> k = Class.forName("com.swordfish.libretrodroid.Variable");
            Object arr = java.lang.reflect.Array.newInstance(k, pares.length);
            for (int i = 0; i < pares.length; i++) java.lang.reflect.Array.set(arr, i, k.getConstructor(String.class, String.class).newInstance(pares[i][0], pares[i][1]));
            retro.getClass().getMethod("updateVariables", arr.getClass()).invoke(retro, arr);
        } catch (Throwable e) { if (mostrar) Toast.makeText(this, "Não consegui mudar essa opção agora.", Toast.LENGTH_SHORT).show(); return; }
        if (!mostrar) return;
        retro.postDelayed(new Runnable() { public void run() {
            StringBuilder r = new StringBuilder();
            try {
                Object[] vs = (Object[]) retro.getClass().getMethod("getVariables").invoke(retro);
                for (Object v : vs) {
                    String key = String.valueOf(v.getClass().getMethod("getKey").invoke(v));
                    if (key.equals("dolphin_texture_cache_accuracy") || key.equals("dolphin_gpu_texture_decoding") || key.equals("dolphin_efb_to_texture"))
                        r.append(key.replace("dolphin_", "")).append(": ").append(v.getClass().getMethod("getValue").invoke(v)).append("\n");
                }
            } catch (Throwable ignora) { }
            Toast.makeText(JogoActivity.this, r.length() == 0 ? "Correção aplicada." : "Correção aplicada\n" + r.toString().trim(), Toast.LENGTH_LONG).show();
        } }, 400);
    }

    private void aplicarQualidadeAoVivo(int q) {
        if (retro == null) return;
        aplicarVariaveisAoVivo(juntar(variaveisDeQualidade(q), variaveisDeCorrecao(correcaoDeCores())), false);
        // imagem mais suave (bilinear) nas qualidades altas; "nítido" no padrão
        try {
            Class<?> k = Class.forName(q >= 1 ? "com.swordfish.libretrodroid.ShaderConfig$Default" : "com.swordfish.libretrodroid.ShaderConfig$Sharp");
            Object cfg = k.getField("INSTANCE").get(null);
            for (java.lang.reflect.Method m : retro.getClass().getMethods()) if (m.getName().equals("setShader") && m.getParameterTypes().length == 1) { m.invoke(retro, cfg); break; }
        } catch (Throwable ignora) { }
    }

    // ------------------------------------------------------------ estados salvos, voltar no tempo, foto da tela e filtros
    /** Consoles leves: guardam os últimos segundos na memória para "voltar no tempo". Os pesados (3D, disco) ficam de fora. */
    private static final java.util.List<String> LEVES = java.util.Arrays.asList("nes", "snes", "gb", "gbc", "gba", "mastersystem", "genesis", "megadrive", "gamegear", "pcengine", "atari2600", "atari7800", "neogeo", "arcade");
    private static final int PASSADO_MAX = 14; // 7 segundos, uma foto do estado a cada meio segundo
    private final java.util.ArrayList<byte[]> passado = new java.util.ArrayList<byte[]>();
    private android.os.HandlerThread fioDoPassado;
    private android.os.Handler maoDoPassado;
    private boolean voltarDisponivel;
    private volatile boolean ocupadoComEstado;

    private File pastaDeEstados() { File f = new File(getFilesDir(), "states"); f.mkdirs(); return f; }
    private File arquivoDoEstado(int espaco) { return new File(pastaDeEstados(), jogoId + "-" + espaco + ".state"); }

    /** Roda algo na linha do vídeo do jogo (a mesma que dá um passo do núcleo), esperando o fim, para nunca mexer no núcleo no meio de um quadro. */
    private boolean naLinhaDoJogo(final Runnable tarefa) {
        final java.util.concurrent.CountDownLatch fim = new java.util.concurrent.CountDownLatch(1);
        Runnable r = new Runnable() { public void run() { try { tarefa.run(); } catch (Throwable ignora) { } fim.countDown(); } };
        try { retro.getClass().getMethod("queueEvent", Runnable.class).invoke(retro, r); } catch (Throwable e) { r.run(); }
        try { return fim.await(2, java.util.concurrent.TimeUnit.SECONDS); } catch (InterruptedException e) { return false; }
    }

    private byte[] serializarEstado() {
        final byte[][] saida = new byte[1][];
        naLinhaDoJogo(new Runnable() { public void run() {
            try { saida[0] = (byte[]) retro.getClass().getMethod("serializeState").invoke(retro); } catch (Throwable e) { saida[0] = null; }
        } });
        return saida[0];
    }
    private boolean restaurarEstado(final byte[] b) {
        if (b == null || b.length == 0) return false;
        final boolean[] ok = new boolean[1];
        naLinhaDoJogo(new Runnable() { public void run() {
            try { Object r = retro.getClass().getMethod("unserializeState", byte[].class).invoke(retro, (Object) b); ok[0] = r == null || Boolean.TRUE.equals(r); } catch (Throwable e) { ok[0] = false; }
        } });
        return ok[0];
    }

    private void ligarEstadosEFoto() {
        voltarDisponivel = LEVES.contains(plataforma);
        gameBar.acoes = new GameBar.AcoesDoJogo() {
            public boolean salvar(int espaco) {
                byte[] b = serializarEstado();
                if (b == null || b.length == 0) return false;
                try { try (FileOutputStream o = new FileOutputStream(arquivoDoEstado(espaco))) { o.write(b); } return true; } catch (Exception e) { return false; }
            }
            public boolean carregar(int espaco) {
                try { File f = arquivoDoEstado(espaco); if (!f.isFile()) return false; return restaurarEstado(Files.readAllBytes(f.toPath())); } catch (Exception e) { return false; }
            }
            public boolean existe(int espaco) { return arquivoDoEstado(espaco).isFile(); }
            public boolean podeVoltar() { return voltarDisponivel; }
            public boolean voltar(int segundos) {
                final byte[] alvo;
                synchronized (passado) {
                    if (passado.size() < 2) return false;
                    int i = Math.max(0, passado.size() - 1 - segundos * 2);
                    alvo = passado.get(i);
                    while (passado.size() > i + 1) passado.remove(passado.size() - 1);
                }
                return restaurarEstado(alvo);
            }
            public boolean capturar() { return tirarFoto(); }
        };
        if (voltarDisponivel) {
            fioDoPassado = new android.os.HandlerThread("vortex-passado");
            fioDoPassado.start();
            maoDoPassado = new android.os.Handler(fioDoPassado.getLooper());
            maoDoPassado.postDelayed(new Runnable() { public void run() {
                if (maoDoPassado == null) return;
                if (!ocupadoComEstado && !isFinishing()) {
                    byte[] b = serializarEstado();
                    if (b != null && b.length > 0) synchronized (passado) { passado.add(b); while (passado.size() > PASSADO_MAX) passado.remove(0); }
                }
                maoDoPassado.postDelayed(this, 500);
            } }, 4000);
        }
    }

    /** Foto da tela do jogo, guardada em Imagens › Vortex (Android 10 ou mais novo) ou na pasta do app. */
    private boolean tirarFoto() {
        try {
            if (android.os.Build.VERSION.SDK_INT < 26) return false;
            final View v = (View) retro;
            if (v.getWidth() <= 0 || v.getHeight() <= 0) return false;
            final android.graphics.Bitmap bm = android.graphics.Bitmap.createBitmap(v.getWidth(), v.getHeight(), android.graphics.Bitmap.Config.ARGB_8888);
            android.view.PixelCopy.request((android.view.SurfaceView) v, bm, new android.view.PixelCopy.OnPixelCopyFinishedListener() {
                public void onPixelCopyFinished(int resultado) {
                    boolean ok = false;
                    if (resultado == android.view.PixelCopy.SUCCESS) ok = guardarFoto(bm);
                    final String msg = ok ? "Foto guardada em Imagens › Vortex." : "Não consegui guardar a foto.";
                    runOnUiThread(new Runnable() { public void run() { Toast.makeText(JogoActivity.this, msg, Toast.LENGTH_SHORT).show(); } });
                }
            }, new android.os.Handler(android.os.Looper.getMainLooper()));
            return true;
        } catch (Throwable e) { return false; }
    }

    private boolean guardarFoto(android.graphics.Bitmap bm) {
        try {
            String nome = "Vortex-" + new java.text.SimpleDateFormat("yyyyMMdd-HHmmss", java.util.Locale.US).format(new java.util.Date()) + ".png";
            if (android.os.Build.VERSION.SDK_INT >= 29) {
                android.content.ContentValues cv = new android.content.ContentValues();
                cv.put(android.provider.MediaStore.Images.Media.DISPLAY_NAME, nome);
                cv.put(android.provider.MediaStore.Images.Media.MIME_TYPE, "image/png");
                cv.put(android.provider.MediaStore.Images.Media.RELATIVE_PATH, "Pictures/Vortex");
                android.net.Uri uri = getContentResolver().insert(android.provider.MediaStore.Images.Media.EXTERNAL_CONTENT_URI, cv);
                if (uri == null) return false;
                try (java.io.OutputStream o = getContentResolver().openOutputStream(uri)) { return bm.compress(android.graphics.Bitmap.CompressFormat.PNG, 100, o); }
            }
            File pasta = getExternalFilesDir(android.os.Environment.DIRECTORY_PICTURES);
            if (pasta == null) return false;
            pasta.mkdirs();
            try (FileOutputStream o = new FileOutputStream(new File(pasta, nome))) { return bm.compress(android.graphics.Bitmap.CompressFormat.PNG, 100, o); }
        } catch (Throwable e) { return false; }
    }

    private int filtroDaImagem() { return getSharedPreferences("vortex_visual", MODE_PRIVATE).getInt("filtro", 0); }

    /** 0 padrão do núcleo (não mexe), 1 nítido, 2 suave, 3 TV de tubo, 4 LCD. Se o motor não oferecer o filtro, avisa e fica como estava. */
    private void aplicarFiltroAoVivo(int f, boolean mostrar) {
        if (retro == null) return;
        String[] nomes = {"Default", "Sharp", "Default", "CRT", "LCD"};
        try {
            Class<?> k = Class.forName("com.swordfish.libretrodroid.ShaderConfig$" + nomes[Math.max(0, Math.min(4, f))]);
            Object cfg;
            try { cfg = k.getField("INSTANCE").get(null); } catch (Throwable semInstancia) { cfg = k.getDeclaredConstructor().newInstance(); }
            boolean achou = false;
            for (java.lang.reflect.Method m : retro.getClass().getMethods()) if (m.getName().equals("setShader") && m.getParameterTypes().length == 1) { m.invoke(retro, cfg); achou = true; break; }
            if (!achou && mostrar) Toast.makeText(this, "Este jogo não aceitou trocar o filtro.", Toast.LENGTH_SHORT).show();
        } catch (Throwable e) { if (mostrar) Toast.makeText(this, "Este motor não tem esse filtro.", Toast.LENGTH_SHORT).show(); }
    }

    private String nucleoAtual = "";
    private String ajustesImagem = "";

    /** Só para GameCube/Wii (os outros sistemas ficam como estão): não pula quadros repetidos e usa o filtro de imagem mais simples. */
    private void ajustesDeImagemDolphin(GLRetroViewData dados) {
        StringBuilder r = new StringBuilder();
        try { dados.getClass().getMethod("setSkipDuplicateFrames", boolean.class).invoke(dados, false); r.append("sem pular quadros; "); } catch (Throwable e) { r.append("(pular quadros: indisponível); "); }
        try {
            Class<?> k = Class.forName("com.swordfish.libretrodroid.ShaderConfig$Sharp");
            Object sharp = k.getField("INSTANCE").get(null);
            for (java.lang.reflect.Method m : dados.getClass().getMethods()) {
                if (m.getName().equals("setShader") && m.getParameterTypes().length == 1) { m.invoke(dados, sharp); r.append("filtro simples; "); break; }
            }
        } catch (Throwable e) { r.append("(filtro: indisponível); "); }
        ajustesImagem = r.toString();
    }

    /** Telas de 120 Hz: pede 60 Hz, que é o ritmo do GameCube/Wii (60 Hz fixos), tanto à janela quanto à superfície do jogo. */
    private void travarEm60Hz() {
        try {
            android.view.WindowManager.LayoutParams lp = getWindow().getAttributes();
            lp.preferredRefreshRate = 60f;
            getWindow().setAttributes(lp);
        } catch (Throwable ignora) { }
        if (android.os.Build.VERSION.SDK_INT >= 30) {
            try { retro.getHolder().getSurface().setFrameRate(60f, android.view.Surface.FRAME_RATE_COMPATIBILITY_FIXED_SOURCE); } catch (Throwable ignora) { }
        }
    }

    /** Opção do núcleo (ex.: dolphin_renderer). Por reflexão porque a classe Variable varia entre versões do LibretroDroid; se não achar, só ignora. */
    private static void definirVariavel(GLRetroViewData dados, String chave, String valor) {
        try {
            Class<?> k = Class.forName("com.swordfish.libretrodroid.Variable");
            for (java.lang.reflect.Constructor<?> c : k.getConstructors()) {
                Class<?>[] t = c.getParameterTypes();
                if (t.length == 2 && t[0] == String.class && t[1] == String.class) {
                    Object v = c.newInstance(chave, valor);
                    Object arr = java.lang.reflect.Array.newInstance(k, 1);
                    java.lang.reflect.Array.set(arr, 0, v);
                    dados.getClass().getMethod("setVariables", arr.getClass()).invoke(dados, arr);
                    return;
                }
            }
        } catch (Throwable ignora) { }
    }

    /** GameCube/Wii: se a tela ficar preta, este botão mostra o que o motor disse e deixa tentar o modo de teste. */
    private void mostrarBotaoDiagnostico() {
        final Button bt = new Button(this);
        bt.setText("Tela preta?");
        bt.setAllCaps(false);
        bt.setTextSize(12);
        bt.setTextColor(Color.WHITE);
        GradientDrawable g = new GradientDrawable();
        g.setColor(Color.argb(190, 20, 20, 30));
        g.setCornerRadius(dp(16));
        bt.setBackground(g);
        bt.setVisibility(View.GONE);
        // no alto, logo à direita do ✕ (que fica no meio): nada do controle fica por baixo e o botão não é cortado
        FrameLayout.LayoutParams lp = new FrameLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, dp(32), Gravity.TOP | Gravity.START);
        lp.topMargin = dp(10);
        lp.leftMargin = getResources().getDisplayMetrics().widthPixels / 2 + dp(30);
        raiz.addView(bt, lp);
        bt.setOnClickListener(new View.OnClickListener() { public void onClick(View v) { diagnosticar(); } });
        bt.postDelayed(new Runnable() { public void run() { bt.setVisibility(View.VISIBLE); } }, 5000);
        bt.postDelayed(new Runnable() { public void run() { bt.setVisibility(View.GONE); } }, 25000); // se o jogo apareceu, o aviso some
    }

    private void diagnosticar() {
        new Thread(new Runnable() {
            public void run() {
                final String relatorio = montarRelatorio();
                runOnUiThread(new Runnable() { public void run() { mostrarRelatorio(relatorio); } });
            }
        }).start();
    }

    private String montarRelatorio() {
        StringBuilder r = new StringBuilder();
        try {
            android.app.ActivityManager am = (android.app.ActivityManager) getSystemService(Context.ACTIVITY_SERVICE);
            int gl = am.getDeviceConfigurationInfo().reqGlEsVersion;
            r.append("Aparelho: ").append(android.os.Build.MANUFACTURER).append(' ').append(android.os.Build.MODEL).append(", Android ").append(android.os.Build.VERSION.RELEASE).append('\n');
            r.append("OpenGL ES: ").append(gl >> 16).append('.').append(gl & 0xffff).append("  ABI: ").append(NucleosAndroid.abi()).append('\n');
            File nucleo = NucleosAndroid.arquivo(this, nucleoAtual);
            r.append("Núcleo ").append(nucleoAtual).append(": ").append(nucleo.isFile() ? (nucleo.length() / 1024) + " KB" : "NÃO ENCONTRADO").append('\n');
            File sys = new File(getFilesDir(), "system/dolphin-emu/Sys");
            r.append("Arquivos de sistema: GC ").append(new File(sys, "GC").isDirectory() ? "ok" : "FALTA").append(", Wii ").append(new File(sys, "Wii").isDirectory() ? "ok" : "FALTA").append('\n');
            r.append("Ajustes de imagem: ").append(ajustesImagem.isEmpty() ? "nenhum" : ajustesImagem).append('\n');
            r.append("Modo: ").append(getIntent().getBooleanExtra("software", false) ? "teste (software)" : "normal").append("\n\n");
        } catch (Throwable e) { r.append("(sem dados do aparelho)\n"); }
        try {
            Process p = Runtime.getRuntime().exec(new String[] { "logcat", "-d", "-t", "4000" });
            java.io.BufferedReader l = new java.io.BufferedReader(new java.io.InputStreamReader(p.getInputStream()));
            java.util.ArrayList<String> linhas = new java.util.ArrayList<String>();
            String x;
            java.util.regex.Pattern re = java.util.regex.Pattern.compile("dolphin|libretro|retro|egl|gles|opengl|vulkan|shader|fatal|denied|sys[ /]|core|jit", java.util.regex.Pattern.CASE_INSENSITIVE);
            while ((x = l.readLine()) != null) { if (x.contains("avc:")) continue; if (re.matcher(x).find()) linhas.add(x.length() > 200 ? x.substring(0, 200) : x); }
            r.append("Mensagens do motor (últimas):\n");
            if (linhas.isEmpty()) r.append("(nenhuma)\n");
            for (int i = Math.max(0, linhas.size() - 70); i < linhas.size(); i++) r.append(linhas.get(i)).append('\n');
        } catch (Throwable e) { r.append("(não consegui ler as mensagens do motor)\n"); }
        String t = r.toString();
        try (FileOutputStream o = new FileOutputStream(new File(getFilesDir(), "diagnostico.txt"))) { o.write(t.getBytes("UTF-8")); } catch (Throwable ignora) { }
        return t;
    }

    private void mostrarRelatorio(final String texto) {
        android.widget.TextView t = new android.widget.TextView(this);
        t.setText(texto);
        t.setTextSize(11);
        t.setTypeface(Typeface.MONOSPACE);
        t.setTextIsSelectable(true);
        t.setPadding(dp(16), dp(8), dp(16), dp(8));
        android.widget.ScrollView sv = new android.widget.ScrollView(this);
        sv.addView(t);
        new androidx.appcompat.app.AlertDialog.Builder(this)
            .setTitle("Diagnóstico do GameCube")
            .setView(sv)
            .setPositiveButton("Modo de teste", new android.content.DialogInterface.OnClickListener() {
                public void onClick(android.content.DialogInterface d, int w) {
                    android.content.Intent i = new android.content.Intent(getIntent());
                    i.putExtra("software", true);
                    finish();
                    startActivity(i);
                }
            })
            .setNeutralButton("Copiar", new android.content.DialogInterface.OnClickListener() {
                public void onClick(android.content.DialogInterface d, int w) {
                    ((android.content.ClipboardManager) getSystemService(Context.CLIPBOARD_SERVICE)).setPrimaryClip(android.content.ClipData.newPlainText("diagnostico", texto));
                }
            })
            .setNegativeButton("Fechar", null)
            .show();
    }

    @Override
    protected void onDestroy() {
        try { ((InputManager) getSystemService(Context.INPUT_SERVICE)).unregisterInputDeviceListener(ouvinte); } catch (Throwable ignora) { }
        if (gameBar != null) gameBar.parar();
        if (fioDoPassado != null) { maoDoPassado = null; fioDoPassado.quitSafely(); }
        super.onDestroy();
    }

    private boolean temControleFisico() {
        for (int id : InputDevice.getDeviceIds()) {
            InputDevice d = InputDevice.getDevice(id);
            if (d != null && !d.isVirtual() && ((d.getSources() & InputDevice.SOURCE_GAMEPAD) == InputDevice.SOURCE_GAMEPAD || (d.getSources() & InputDevice.SOURCE_JOYSTICK) == InputDevice.SOURCE_JOYSTICK)) return true;
        }
        return false;
    }

    private void atualizarControles() { controles.setVisibility(controleDetectado || temControleFisico() ? View.GONE : View.VISIBLE); }

    @Override
    public boolean dispatchKeyEvent(KeyEvent e) {
        // qualquer tecla vinda de um controle prova que ele está conectado (alguns aparelhos o listam de um jeito que a busca não vê)
        if (!controleDetectado && (e.getSource() & InputDevice.SOURCE_GAMEPAD) == InputDevice.SOURCE_GAMEPAD) { controleDetectado = true; atualizarControles(); }
        if (e.getKeyCode() == KeyEvent.KEYCODE_BACK && e.getAction() == KeyEvent.ACTION_UP) { finish(); return true; }
        // botão "voltar" do controle (Select longo seria demais): Mode/Guide sai do jogo
        if (e.getKeyCode() == KeyEvent.KEYCODE_BUTTON_MODE && e.getAction() == KeyEvent.ACTION_UP) { finish(); return true; }
        return super.dispatchKeyEvent(e);
    }

    @Override
    public boolean dispatchGenericMotionEvent(MotionEvent e) {
        if (retro != null && (e.getSource() & InputDevice.SOURCE_JOYSTICK) == InputDevice.SOURCE_JOYSTICK) { if (!controleDetectado) { controleDetectado = true; atualizarControles(); } return retro.onGenericMotionEvent(e); }
        return super.dispatchGenericMotionEvent(e);
    }

    @Override
    protected void onPause() {
        ocupadoComEstado = true;
        guardarSave();
        super.onPause();
    }

    @Override
    protected void onResume() {
        super.onResume();
        ocupadoComEstado = false;
        atualizarControles();
        if (gameBar != null) gameBar.recarregar();
    }

    private void guardarSave() {
        try {
            byte[] s = retro.serializeSRAM(true);
            if (s != null && s.length > 0) { try (FileOutputStream o = new FileOutputStream(srm)) { o.write(s); } }
        } catch (Throwable ignora) { }
    }

    // ------------------------------------------------------------ botões na tela (quando não há controle conectado)
    private int dp(float v) { return (int) TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, v, getResources().getDisplayMetrics()); }
    /** Tamanho e distâncias dos botões seguem a escolha da pessoa (pequeno, médio, grande). */
    private int ds(float v) { return dp(v * escala); }

    // aparência escolhida em Personalização (o app grava aqui; o jogo lê ao abrir)
    private int cor = Color.rgb(255, 42, 61);
    private String modelo = "circulo";
    private float escala = 1f;
    private int opac = 85;
    private String plataforma = "";
    private String disposicoesJson = "{}";

    /** Controle virtual deste console: o automático, ou o que a pessoa escolheu para ele em Ajustes. */
    private DisposicaoControles disposicao() {
        String plat = plataforma;
        if ((plat == null || plat.isEmpty()) && nucleoAtual.startsWith("dolphin")) plat = "gamecube"; // jogo aberto sem a plataforma: o núcleo diz
        return DisposicaoControles.de(plat, DisposicaoControles.escolhaDe(disposicoesJson, plat));
    }

    /** Chamado pelo app sempre que a pessoa muda a cor do sistema ou o modelo dos botões. */
    public static Object gravarVisual(Context ctx, org.json.JSONObject a) throws Exception {
        ctx.getSharedPreferences("vortex_visual", MODE_PRIVATE).edit()
            .putString("cor", a.optString("cor", "#ff2a3d"))
            .putString("modelo", a.optString("modelo", "circulo"))
            .putString("tamanho", a.optString("tamanho", "medio"))
            .putInt("opacidade", a.optInt("opacidade", 85))
            .putString("disposicoes", a.optString("disposicoes", "{}"))
            .apply();
        return new org.json.JSONObject().put("ok", true);
    }

    private void lerVisual() {
        android.content.SharedPreferences sp = getSharedPreferences("vortex_visual", MODE_PRIVATE);
        try { cor = Color.parseColor(sp.getString("cor", "#ff2a3d")); } catch (Exception ignora) { cor = Color.rgb(255, 42, 61); }
        modelo = sp.getString("modelo", "circulo");
        String t = sp.getString("tamanho", "medio");
        escala = "pequeno".equals(t) ? 0.85f : "grande".equals(t) ? 1.2f : 1f;
        opac = Math.max(30, Math.min(100, sp.getInt("opacidade", 85)));
        disposicoesJson = sp.getString("disposicoes", "{}");
    }

    private int comAlfa(int c, int alfa) { return Color.argb(Math.max(0, Math.min(255, alfa)), Color.red(c), Color.green(c), Color.blue(c)); }

    /** Fundo do botão conforme o modelo; pressionado, ele acende na cor do sistema. */
    private GradientDrawable fundo(boolean pilula, boolean apertado) {
        GradientDrawable g = new GradientDrawable();
        int a = opac * 255 / 100;
        boolean redondo = modelo.equals("circulo") && !pilula;
        if (redondo) g.setShape(GradientDrawable.OVAL);
        else g.setCornerRadius(dp(pilula ? 16 : modelo.equals("quadrado") ? 12 : modelo.equals("neon") ? 10 : 18));
        if (apertado) { g.setColor(comAlfa(cor, 200)); g.setStroke(dp(2), Color.WHITE); return g; }
        if (modelo.equals("neon")) { g.setColor(comAlfa(cor, 28 * a / 255)); g.setStroke(dp(3), comAlfa(cor, a)); }
        else if (modelo.equals("vidro")) { g.setColor(Color.argb(70 * a / 255, 255, 255, 255)); g.setStroke(dp(1), Color.argb(150 * a / 255, 255, 255, 255)); }
        else { g.setColor(comAlfa(Color.rgb(Color.red(cor) / 6, Color.green(cor) / 6, Color.blue(cor) / 6 + 12), 170 * a / 255)); g.setStroke(dp(2), comAlfa(cor, a)); }
        return g;
    }

    private Button botao(String rotulo, final int tecla, final boolean pilula) {
        final Button bt = new Button(this);
        bt.setText(rotulo);
        bt.setTextColor(modelo.equals("neon") ? cor : Color.WHITE);
        bt.setTypeface(Typeface.DEFAULT_BOLD);
        bt.setAllCaps(false);
        bt.setPadding(0, 0, 0, 0);
        if (pilula) bt.setTextSize(10);
        bt.setBackground(fundo(pilula, false));
        final long[] inicio = new long[1];
        bt.setOnTouchListener(new View.OnTouchListener() {
            public boolean onTouch(View v, MotionEvent ev) {
                int ac = ev.getActionMasked();
                if (ac == MotionEvent.ACTION_DOWN || ac == MotionEvent.ACTION_POINTER_DOWN) { inicio[0] = android.os.SystemClock.uptimeMillis(); retro.sendKeyEvent(KeyEvent.ACTION_DOWN, tecla, 0); v.setBackground(fundo(pilula, true)); }
                else if (ac == MotionEvent.ACTION_UP || ac == MotionEvent.ACTION_CANCEL || ac == MotionEvent.ACTION_POINTER_UP) {
                    v.setBackground(fundo(pilula, false));
                    long falta = 90 - (android.os.SystemClock.uptimeMillis() - inicio[0]);
                    if (falta > 0) v.postDelayed(new Runnable() { public void run() { retro.sendKeyEvent(KeyEvent.ACTION_UP, tecla, 0); } }, falta);
                    else retro.sendKeyEvent(KeyEvent.ACTION_UP, tecla, 0);
                }
                return true;
            }
        });
        return bt;
    }

    private void por(FrameLayout f, Button bt, int tam, int gravidade, int mx, int my) {
        FrameLayout.LayoutParams p = new FrameLayout.LayoutParams(ds(tam), ds(tam), gravidade);
        p.setMargins(ds(mx), ds(my), ds(mx), ds(my));
        f.addView(bt, p);
    }


    private FrameLayout.LayoutParams pAnalogico(int grav, int mx, int my, int tam) {
        FrameLayout.LayoutParams p = new FrameLayout.LayoutParams(ds(tam), ds(tam), grav);
        p.setMargins(ds(mx), ds(my), ds(mx), ds(my));
        return p;
    }

    /** Alavanca na tela (toque e arraste): manda a posição ao motor como analógico esquerdo (1) ou direito/C-stick (2). */
    private final class Analogico extends View {
        private final int fonte;
        private float px, py;
        private boolean ativo;
        private final android.graphics.Paint tinta = new android.graphics.Paint(android.graphics.Paint.ANTI_ALIAS_FLAG);
        Analogico(int fonte) { super(JogoActivity.this); this.fonte = fonte; }
        @Override protected void onDraw(android.graphics.Canvas c) {
            float r = Math.min(getWidth(), getHeight()) / 2f, cx = getWidth() / 2f, cy = getHeight() / 2f;
            tinta.setStyle(android.graphics.Paint.Style.FILL); tinta.setColor(comAlfa(cor, 40));
            c.drawCircle(cx, cy, r - dp(2), tinta);
            tinta.setStyle(android.graphics.Paint.Style.STROKE); tinta.setStrokeWidth(dp(3)); tinta.setColor(comAlfa(cor, 200));
            c.drawCircle(cx, cy, r - dp(2), tinta);
            tinta.setStyle(android.graphics.Paint.Style.FILL); tinta.setColor(comAlfa(cor, ativo ? 230 : 150));
            c.drawCircle(cx + px * r * 0.55f, cy + py * r * 0.55f, r * 0.38f, tinta);
            if (fonte == 2) { tinta.setColor(Color.WHITE); tinta.setTextAlign(android.graphics.Paint.Align.CENTER); tinta.setTextSize(r * 0.34f); c.drawText("C", cx + px * r * 0.55f, cy + py * r * 0.55f + r * 0.12f, tinta); }
        }
        @Override public boolean onTouchEvent(MotionEvent ev) {
            int ac = ev.getActionMasked();
            if (ac == MotionEvent.ACTION_UP || ac == MotionEvent.ACTION_CANCEL) { ativo = false; px = 0; py = 0; enviar(); invalidate(); return true; }
            if (ac == MotionEvent.ACTION_DOWN || ac == MotionEvent.ACTION_MOVE) {
                float r = Math.min(getWidth(), getHeight()) / 2f;
                float dx = (ev.getX() - getWidth() / 2f) / (r * 0.8f), dy = (ev.getY() - getHeight() / 2f) / (r * 0.8f);
                float m = (float) Math.sqrt(dx * dx + dy * dy);
                if (m > 1f) { dx /= m; dy /= m; }
                px = dx; py = dy; ativo = true; enviar(); invalidate();
            }
            return true;
        }
        private void enviar() { try { retro.sendMotionEvent(fonte, px, py, 0); } catch (Throwable ignora) { } }
    }

    private View montarControles() {
        lerVisual();
        FrameLayout f = new FrameLayout(this);
        int L = Gravity.START | Gravity.BOTTOM, R = Gravity.END | Gravity.BOTTOM;
        final DisposicaoControles d = disposicao();
        // esquerda: direcional e/ou analógico, conforme o que o console usa (ou o que a pessoa escolheu para ele)
        if (d.analogicoEsq && d.direcional == DisposicaoControles.SEM) {
            f.addView(new Analogico(1), pAnalogico(L, 24, 24, 130));
        } else if (d.analogicoEsq) {
            // o analógico guia (personagem, carro); o direcional pequeno serve para menus e opções
            f.addView(new Analogico(1), pAnalogico(L, 24, 14, 120));
            por(f, botao("▲", KeyEvent.KEYCODE_DPAD_UP, false), 34, L, 67, 206);
            por(f, botao("◀", KeyEvent.KEYCODE_DPAD_LEFT, false), 34, L, 33, 172);
            por(f, botao("▶", KeyEvent.KEYCODE_DPAD_RIGHT, false), 34, L, 101, 172);
            por(f, botao("▼", KeyEvent.KEYCODE_DPAD_DOWN, false), 34, L, 67, 138);
        } else {
            por(f, botao("▲", KeyEvent.KEYCODE_DPAD_UP, false), 56, L, 72, 150);
            por(f, botao("▼", KeyEvent.KEYCODE_DPAD_DOWN, false), 56, L, 72, 20);
            por(f, botao("◀", KeyEvent.KEYCODE_DPAD_LEFT, false), 56, L, 14, 85);
            por(f, botao("▶", KeyEvent.KEYCODE_DPAD_RIGHT, false), 56, L, 130, 85);
        }
        // direita: botões de ação no padrão do RetroPad (B embaixo, A à direita, Y à esquerda, X em cima)
        boolean ps = DisposicaoControles.PS.equals(d.botoes);
        if (DisposicaoControles.AB.equals(d.botoes)) {
            por(f, botao("B", KeyEvent.KEYCODE_BUTTON_B, false), 60, R, 100, 70);
            por(f, botao("A", KeyEvent.KEYCODE_BUTTON_A, false), 60, R, 30, 104);
        } else {
            por(f, botao(ps ? "△" : "X", KeyEvent.KEYCODE_BUTTON_X, false), 56, R, 72, 150);
            por(f, botao(ps ? "✕" : "B", KeyEvent.KEYCODE_BUTTON_B, false), 56, R, 72, 20);
            por(f, botao(ps ? "□" : "Y", KeyEvent.KEYCODE_BUTTON_Y, false), 56, R, 130, 85);
            por(f, botao(ps ? "○" : "A", KeyEvent.KEYCODE_BUTTON_A, false), 56, R, 14, 85);
        }
        if (d.analogicoDir) f.addView(new Analogico(2), pAnalogico(R, 56, 214, 90));
        // ombros
        int TL = Gravity.START | Gravity.TOP, TR = Gravity.END | Gravity.TOP;
        String o = d.ombros;
        if (DisposicaoControles.GC.equals(o)) {
            // GameCube: os gatilhos L e R (acelerar e frear) são o L2 e o R2 do núcleo; o Z é o R1
            por(f, botao("L", KeyEvent.KEYCODE_BUTTON_L2, false), 44, TL, 20, 12);
            por(f, botao("R", KeyEvent.KEYCODE_BUTTON_R2, false), 44, TR, 20, 12);
            por(f, botao("Z", KeyEvent.KEYCODE_BUTTON_R1, false), 44, TR, 74, 12);
        } else if (DisposicaoControles.N64.equals(o)) {
            por(f, botao("L", KeyEvent.KEYCODE_BUTTON_L1, false), 44, TL, 20, 12);
            por(f, botao("Z", KeyEvent.KEYCODE_BUTTON_L2, false), 44, TL, 74, 12);
            por(f, botao("R", KeyEvent.KEYCODE_BUTTON_R1, false), 44, TR, 20, 12);
        } else if (DisposicaoControles.GATILHOS.equals(o)) {
            por(f, botao("LT", KeyEvent.KEYCODE_BUTTON_L2, false), 44, TL, 20, 12);
            por(f, botao("RT", KeyEvent.KEYCODE_BUTTON_R2, false), 44, TR, 20, 12);
        } else if (DisposicaoControles.LR2.equals(o)) {
            boolean n3ds = "3ds".equals(plataforma);
            por(f, botao(ps ? "L1" : "L", KeyEvent.KEYCODE_BUTTON_L1, false), 44, TL, 20, 12);
            por(f, botao(ps ? "R1" : "R", KeyEvent.KEYCODE_BUTTON_R1, false), 44, TR, 20, 12);
            por(f, botao(ps ? "L2" : n3ds ? "ZL" : "L2", KeyEvent.KEYCODE_BUTTON_L2, false), 44, TL, 74, 12);
            por(f, botao(ps ? "R2" : n3ds ? "ZR" : "R2", KeyEvent.KEYCODE_BUTTON_R2, false), 44, TR, 74, 12);
        } else if (DisposicaoControles.LR.equals(o)) {
            por(f, botao("L", KeyEvent.KEYCODE_BUTTON_L1, false), 44, TL, 20, 12);
            por(f, botao("R", KeyEvent.KEYCODE_BUTTON_R1, false), 44, TR, 20, 12);
        }
        if (d.select) {
            FrameLayout.LayoutParams psel = new FrameLayout.LayoutParams(ds(54), ds(32), Gravity.CENTER_HORIZONTAL | Gravity.BOTTOM);
            psel.setMargins(ds(-34), 0, 0, ds(14));
            f.addView(botao("Select", KeyEvent.KEYCODE_BUTTON_SELECT, true), psel);
        }
        FrameLayout.LayoutParams pt = new FrameLayout.LayoutParams(ds(54), ds(32), Gravity.CENTER_HORIZONTAL | Gravity.BOTTOM);
        pt.setMargins(d.select ? ds(34) : 0, 0, 0, ds(14));
        f.addView(botao("Start", KeyEvent.KEYCODE_BUTTON_START, true), pt);
        Button sair = new Button(this);
        sair.setText("✕");
        sair.setTextColor(Color.WHITE);
        GradientDrawable gs = new GradientDrawable();
        gs.setCornerRadius(dp(10));
        gs.setColor(comAlfa(cor, 110));
        sair.setBackground(gs);
        sair.setOnClickListener(new View.OnClickListener() { public void onClick(View v) { finish(); } });
        FrameLayout.LayoutParams pq = new FrameLayout.LayoutParams(dp(40), dp(40), Gravity.CENTER_HORIZONTAL | Gravity.TOP);
        pq.setMargins(0, dp(10), 0, 0);
        f.addView(sair, pq);
        return f;
    }
}

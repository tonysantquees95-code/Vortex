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
import android.widget.FrameLayout;

import androidx.appcompat.app.AppCompatActivity;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;

import com.swordfish.libretrodroid.GLRetroView;
import com.swordfish.libretrodroid.GLRetroViewData;
import com.swordfish.libretrodroid.Variable;

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

    @Override
    protected void onCreate(Bundle b) {
        super.onCreate(b);
        String rom = getIntent().getStringExtra("rom");
        String nucleo = getIntent().getStringExtra("nucleo");
        String id = getIntent().getStringExtra("id");
        File savesDir = new File(getFilesDir(), "saves");
        savesDir.mkdirs();
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
        // modo de teste do GameCube/Wii: desenho por software (lento, mas mostra se o problema é a placa de vídeo)
        if (getIntent().getBooleanExtra("software", false) && nucleoAtual.startsWith("dolphin")) dados.setVariables(new Variable[] { new Variable("dolphin_renderer", "Software") });
        try { if (srm.isFile()) dados.setSaveRAMState(Files.readAllBytes(srm.toPath())); } catch (Exception ignora) { }

        retro = new GLRetroView(this, dados);
        getLifecycle().addObserver(retro);
        raiz = new FrameLayout(this);
        raiz.setBackgroundColor(Color.BLACK);
        raiz.addView(retro, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        controles = montarControles();
        raiz.addView(controles);
        setContentView(raiz);
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
        gameBar.iniciar();
        if (nucleoAtual.startsWith("dolphin")) mostrarBotaoDiagnostico();
    }

    private String nucleoAtual = "";

    /** GameCube/Wii: se a tela ficar preta, este botão mostra o que o motor disse e deixa tentar o modo de teste. */
    private void mostrarBotaoDiagnostico() {
        final Button bt = new Button(this);
        bt.setText("Tela preta? Diagnóstico");
        bt.setAllCaps(false);
        bt.setTextSize(12);
        bt.setTextColor(Color.WHITE);
        GradientDrawable g = new GradientDrawable();
        g.setColor(Color.argb(190, 20, 20, 30));
        g.setCornerRadius(dp(16));
        bt.setBackground(g);
        bt.setVisibility(View.GONE);
        FrameLayout.LayoutParams lp = new FrameLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, dp(34), Gravity.TOP | Gravity.START);
        lp.leftMargin = dp(10);
        lp.topMargin = dp(36);
        raiz.addView(bt, lp);
        bt.setOnClickListener(new View.OnClickListener() { public void onClick(View v) { diagnosticar(); } });
        bt.postDelayed(new Runnable() { public void run() { bt.setVisibility(View.VISIBLE); } }, 5000);
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
            r.append("Modo: ").append(getIntent().getBooleanExtra("software", false) ? "teste (software)" : "normal").append("\n\n");
        } catch (Throwable e) { r.append("(sem dados do aparelho)\n"); }
        try {
            Process p = Runtime.getRuntime().exec(new String[] { "logcat", "-d", "-t", "600" });
            java.io.BufferedReader l = new java.io.BufferedReader(new java.io.InputStreamReader(p.getInputStream()));
            java.util.ArrayList<String> linhas = new java.util.ArrayList<String>();
            String x;
            java.util.regex.Pattern re = java.util.regex.Pattern.compile("dolphin|libretro|retro|egl|gles|opengl|vulkan|shader|fatal|denied|sys[ /]|core|jit", java.util.regex.Pattern.CASE_INSENSITIVE);
            while ((x = l.readLine()) != null) if (re.matcher(x).find()) linhas.add(x.length() > 200 ? x.substring(0, 200) : x);
            r.append("Mensagens do motor (últimas):\n");
            if (linhas.isEmpty()) r.append("(nenhuma)\n");
            for (int i = Math.max(0, linhas.size() - 40); i < linhas.size(); i++) r.append(linhas.get(i)).append('\n');
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
        guardarSave();
        super.onPause();
    }

    @Override
    protected void onResume() {
        super.onResume();
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

    /** Chamado pelo app sempre que a pessoa muda a cor do sistema ou o modelo dos botões. */
    public static Object gravarVisual(Context ctx, org.json.JSONObject a) throws Exception {
        ctx.getSharedPreferences("vortex_visual", MODE_PRIVATE).edit()
            .putString("cor", a.optString("cor", "#ff2a3d"))
            .putString("modelo", a.optString("modelo", "circulo"))
            .putString("tamanho", a.optString("tamanho", "medio"))
            .putInt("opacidade", a.optInt("opacidade", 85))
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
        bt.setOnTouchListener(new View.OnTouchListener() {
            public boolean onTouch(View v, MotionEvent ev) {
                int ac = ev.getActionMasked();
                if (ac == MotionEvent.ACTION_DOWN || ac == MotionEvent.ACTION_POINTER_DOWN) { retro.sendKeyEvent(KeyEvent.ACTION_DOWN, tecla, 0); v.setBackground(fundo(pilula, true)); }
                else if (ac == MotionEvent.ACTION_UP || ac == MotionEvent.ACTION_CANCEL || ac == MotionEvent.ACTION_POINTER_UP) { retro.sendKeyEvent(KeyEvent.ACTION_UP, tecla, 0); v.setBackground(fundo(pilula, false)); }
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

    private View montarControles() {
        lerVisual();
        FrameLayout f = new FrameLayout(this);
        int L = Gravity.START | Gravity.BOTTOM, R = Gravity.END | Gravity.BOTTOM;
        // direcional (esquerda)
        por(f, botao("▲", KeyEvent.KEYCODE_DPAD_UP, false), 56, L, 72, 150);
        por(f, botao("▼", KeyEvent.KEYCODE_DPAD_DOWN, false), 56, L, 72, 20);
        por(f, botao("◀", KeyEvent.KEYCODE_DPAD_LEFT, false), 56, L, 14, 85);
        por(f, botao("▶", KeyEvent.KEYCODE_DPAD_RIGHT, false), 56, L, 130, 85);
        // botões de ação no padrão do RetroPad: B embaixo, A à direita, Y à esquerda, X em cima
        por(f, botao("X", KeyEvent.KEYCODE_BUTTON_X, false), 56, R, 72, 150);
        por(f, botao("B", KeyEvent.KEYCODE_BUTTON_B, false), 56, R, 72, 20);
        por(f, botao("Y", KeyEvent.KEYCODE_BUTTON_Y, false), 56, R, 130, 85);
        por(f, botao("A", KeyEvent.KEYCODE_BUTTON_A, false), 56, R, 14, 85);
        // ombros e menu
        por(f, botao("L", KeyEvent.KEYCODE_BUTTON_L1, false), 44, Gravity.START | Gravity.TOP, 20, 12);
        por(f, botao("R", KeyEvent.KEYCODE_BUTTON_R1, false), 44, Gravity.END | Gravity.TOP, 20, 12);
        FrameLayout.LayoutParams ps = new FrameLayout.LayoutParams(ds(54), ds(32), Gravity.CENTER_HORIZONTAL | Gravity.BOTTOM);
        ps.setMargins(ds(-34), 0, 0, ds(14));
        f.addView(botao("Select", KeyEvent.KEYCODE_BUTTON_SELECT, true), ps);
        FrameLayout.LayoutParams pt = new FrameLayout.LayoutParams(ds(54), ds(32), Gravity.CENTER_HORIZONTAL | Gravity.BOTTOM);
        pt.setMargins(ds(34), 0, 0, ds(14));
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

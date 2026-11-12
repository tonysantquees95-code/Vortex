package tech.vetorial.vortex;

import android.content.Context;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.os.Bundle;
import android.util.TypedValue;
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

import java.io.File;
import java.io.FileOutputStream;
import java.nio.file.Files;

/** Tela do jogo: o próprio Vortex roda o núcleo (LibretroDroid), com controle físico ou botões na tela. Guarda o save (SRAM) ao sair. */
public class JogoActivity extends AppCompatActivity {
    private GLRetroView retro;
    private File srm;
    private FrameLayout raiz;
    private View controles;

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
    }

    private boolean temControleFisico() {
        for (int id : InputDevice.getDeviceIds()) {
            InputDevice d = InputDevice.getDevice(id);
            if (d != null && !d.isVirtual() && ((d.getSources() & InputDevice.SOURCE_GAMEPAD) == InputDevice.SOURCE_GAMEPAD || (d.getSources() & InputDevice.SOURCE_JOYSTICK) == InputDevice.SOURCE_JOYSTICK)) return true;
        }
        return false;
    }

    private void atualizarControles() { controles.setVisibility(temControleFisico() ? View.GONE : View.VISIBLE); }

    @Override
    public boolean dispatchKeyEvent(KeyEvent e) {
        if (e.getKeyCode() == KeyEvent.KEYCODE_BACK && e.getAction() == KeyEvent.ACTION_UP) { finish(); return true; }
        // botão "voltar" do controle (Select longo seria demais): Mode/Guide sai do jogo
        if (e.getKeyCode() == KeyEvent.KEYCODE_BUTTON_MODE && e.getAction() == KeyEvent.ACTION_UP) { finish(); return true; }
        return super.dispatchKeyEvent(e);
    }

    @Override
    public boolean dispatchGenericMotionEvent(MotionEvent e) {
        if (retro != null && (e.getSource() & InputDevice.SOURCE_JOYSTICK) == InputDevice.SOURCE_JOYSTICK) { atualizarControles(); return retro.onGenericMotionEvent(e); }
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
    }

    private void guardarSave() {
        try {
            byte[] s = retro.serializeSRAM(true);
            if (s != null && s.length > 0) { try (FileOutputStream o = new FileOutputStream(srm)) { o.write(s); } }
        } catch (Throwable ignora) { }
    }

    // ------------------------------------------------------------ botões na tela (quando não há controle conectado)
    private int dp(float v) { return (int) TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, v, getResources().getDisplayMetrics()); }

    private Button botao(String rotulo, final int tecla, int tam) {
        Button bt = new Button(this);
        bt.setText(rotulo);
        bt.setTextColor(Color.WHITE);
        bt.setTypeface(Typeface.DEFAULT_BOLD);
        bt.setAllCaps(false);
        bt.setPadding(0, 0, 0, 0);
        GradientDrawable g = new GradientDrawable();
        g.setShape(GradientDrawable.OVAL);
        g.setColor(Color.argb(110, 30, 40, 80));
        g.setStroke(dp(2), Color.argb(170, 25, 227, 255));
        bt.setBackground(g);
        bt.setOnTouchListener(new View.OnTouchListener() {
            public boolean onTouch(View v, MotionEvent ev) {
                int a = ev.getActionMasked();
                if (a == MotionEvent.ACTION_DOWN || a == MotionEvent.ACTION_POINTER_DOWN) { retro.sendKeyEvent(KeyEvent.ACTION_DOWN, tecla, 0); v.setPressed(true); v.setAlpha(0.6f); }
                else if (a == MotionEvent.ACTION_UP || a == MotionEvent.ACTION_CANCEL || a == MotionEvent.ACTION_POINTER_UP) { retro.sendKeyEvent(KeyEvent.ACTION_UP, tecla, 0); v.setPressed(false); v.setAlpha(1f); }
                return true;
            }
        });
        return bt;
    }

    private void por(FrameLayout f, Button bt, int tam, int gravidade, int mx, int my) {
        FrameLayout.LayoutParams p = new FrameLayout.LayoutParams(dp(tam), dp(tam), gravidade);
        p.setMargins(dp(mx), dp(my), dp(mx), dp(my));
        f.addView(bt, p);
    }

    private View montarControles() {
        FrameLayout f = new FrameLayout(this);
        int L = Gravity.START | Gravity.BOTTOM, R = Gravity.END | Gravity.BOTTOM;
        // direcional (esquerda)
        por(f, botao("▲", KeyEvent.KEYCODE_DPAD_UP, 56), 56, L, 72, 150);
        por(f, botao("▼", KeyEvent.KEYCODE_DPAD_DOWN, 56), 56, L, 72, 20);
        por(f, botao("◀", KeyEvent.KEYCODE_DPAD_LEFT, 56), 56, L, 14, 85);
        por(f, botao("▶", KeyEvent.KEYCODE_DPAD_RIGHT, 56), 56, L, 130, 85);
        // botões de ação no padrão do RetroPad: B embaixo, A à direita, Y à esquerda, X em cima
        por(f, botao("X", KeyEvent.KEYCODE_BUTTON_X, 56), 56, R, 72, 150);
        por(f, botao("B", KeyEvent.KEYCODE_BUTTON_B, 56), 56, R, 72, 20);
        por(f, botao("Y", KeyEvent.KEYCODE_BUTTON_Y, 56), 56, R, 130, 85);
        por(f, botao("A", KeyEvent.KEYCODE_BUTTON_A, 56), 56, R, 14, 85);
        // ombros e menu
        por(f, botao("L", KeyEvent.KEYCODE_BUTTON_L1, 44), 44, Gravity.START | Gravity.TOP, 20, 12);
        por(f, botao("R", KeyEvent.KEYCODE_BUTTON_R1, 44), 44, Gravity.END | Gravity.TOP, 20, 12);
        FrameLayout.LayoutParams ps = new FrameLayout.LayoutParams(dp(54), dp(32), Gravity.CENTER_HORIZONTAL | Gravity.BOTTOM);
        ps.setMargins(dp(-34), 0, 0, dp(14));
        f.addView(botaoPilula("Select", KeyEvent.KEYCODE_BUTTON_SELECT), ps);
        FrameLayout.LayoutParams pt = new FrameLayout.LayoutParams(dp(54), dp(32), Gravity.CENTER_HORIZONTAL | Gravity.BOTTOM);
        pt.setMargins(dp(34), 0, 0, dp(14));
        f.addView(botaoPilula("Start", KeyEvent.KEYCODE_BUTTON_START), pt);
        Button sair = new Button(this);
        sair.setText("✕");
        sair.setTextColor(Color.WHITE);
        sair.setBackgroundColor(Color.argb(90, 120, 20, 40));
        sair.setOnClickListener(new View.OnClickListener() { public void onClick(View v) { finish(); } });
        FrameLayout.LayoutParams pq = new FrameLayout.LayoutParams(dp(40), dp(40), Gravity.CENTER_HORIZONTAL | Gravity.TOP);
        pq.setMargins(0, dp(10), 0, 0);
        f.addView(sair, pq);
        return f;
    }

    private Button botaoPilula(String rotulo, int tecla) {
        Button bt = botao(rotulo, tecla, 0);
        bt.setTextSize(10);
        GradientDrawable g = new GradientDrawable();
        g.setCornerRadius(dp(16));
        g.setColor(Color.argb(110, 30, 40, 80));
        g.setStroke(dp(1), Color.argb(170, 25, 227, 255));
        bt.setBackground(g);
        return bt;
    }
}

package tech.vetorial.vortex;

import android.accessibilityservice.AccessibilityService;
import android.accessibilityservice.GestureDescription;
import android.graphics.Color;
import android.graphics.Path;
import android.graphics.PixelFormat;
import android.graphics.drawable.GradientDrawable;
import android.os.Handler;
import android.os.Looper;
import android.util.DisplayMetrics;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.InputDevice;
import android.view.KeyEvent;
import android.view.MotionEvent;
import android.view.View;
import android.view.WindowManager;
import android.view.accessibility.AccessibilityEvent;
import android.widget.Button;
import android.widget.FrameLayout;
import android.widget.TextView;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.File;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/** Controle para jogos de Android que não têm suporte: transforma os botões do controle em toques na tela, conforme o perfil do jogo. */
public class ControleService extends AccessibilityService {
    public static ControleService instancia;

    private static final int DURACAO = 60;
    private final Handler main = new Handler(Looper.getMainLooper());
    private final Map<String, Toque> toques = new HashMap<String, Toque>();
    private final Set<Integer> direcoes = new HashSet<Integer>();
    private String pacoteAtual = "";
    private JSONObject perfil;
    private boolean despachando;
    private boolean editando;
    private FrameLayout editor;

    private static final class Toque {
        float x, y, ultX, ultY;
        GestureDescription.StrokeDescription desc;
        boolean soltar;
        Toque(float x, float y) { this.x = x; this.y = y; this.ultX = x; this.ultY = y; }
    }

    public static File arquivoDePerfis(android.content.Context c) { return new File(c.getFilesDir(), "vortex/perfis.json"); }

    @Override
    protected void onServiceConnected() { instancia = this; }

    @Override
    public boolean onUnbind(android.content.Intent i) { instancia = null; return super.onUnbind(i); }

    @Override
    public void onInterrupt() { soltarTudo(); }

    @Override
    public void onAccessibilityEvent(AccessibilityEvent e) {
        if (e.getEventType() != AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED || e.getPackageName() == null) return;
        String p = e.getPackageName().toString();
        if (p.equals(pacoteAtual) || p.equals("com.android.systemui") || p.equals(getPackageName())) return;
        pacoteAtual = p;
        soltarTudo();
        perfil = Perfis.ativoDe(Perfis.carregar(arquivoDePerfis(this)), p);
    }

    /** Recarrega o perfil do jogo que está na tela (depois de salvar ou trocar o perfil ativo). */
    public void recarregar() { perfil = Perfis.ativoDe(Perfis.carregar(arquivoDePerfis(this)), pacoteAtual); }

    public String pacoteAtual() { return pacoteAtual; }

    @Override
    protected boolean onKeyEvent(KeyEvent e) {
        if (perfil == null || editando) return false;
        int s = e.getSource();
        if ((s & InputDevice.SOURCE_GAMEPAD) != InputDevice.SOURCE_GAMEPAD && (s & InputDevice.SOURCE_DPAD) != InputDevice.SOURCE_DPAD) return false;
        int k = e.getKeyCode();
        boolean dir = k == KeyEvent.KEYCODE_DPAD_UP || k == KeyEvent.KEYCODE_DPAD_DOWN || k == KeyEvent.KEYCODE_DPAD_LEFT || k == KeyEvent.KEYCODE_DPAD_RIGHT;
        if (dir) {
            if (e.getAction() == KeyEvent.ACTION_DOWN) direcoes.add(k); else if (e.getAction() == KeyEvent.ACTION_UP) direcoes.remove(k);
            atualizarDirecional();
            return true;
        }
        double[] alvo = Perfis.alvoDaTecla(perfil, k);
        if (alvo == null) return false;
        String id = Perfis.nomeDaTecla(k);
        if (e.getAction() == KeyEvent.ACTION_DOWN && e.getRepeatCount() == 0) { apertar(id, (float) alvo[0], (float) alvo[1]); return true; }
        if (e.getAction() == KeyEvent.ACTION_UP) { soltar(id); return true; }
        return true;
    }

    private DisplayMetrics tela() { return getResources().getDisplayMetrics(); }

    private void atualizarDirecional() {
        try {
            JSONObject d = perfil.getJSONObject("direcional");
            DisplayMetrics m = tela();
            float cx = (float) d.getDouble("cx") * m.widthPixels, cy = (float) d.getDouble("cy") * m.heightPixels, r = (float) d.getDouble("raio") * Math.min(m.widthPixels, m.heightPixels);
            float dx = 0, dy = 0;
            if (direcoes.contains(KeyEvent.KEYCODE_DPAD_LEFT)) dx -= 1;
            if (direcoes.contains(KeyEvent.KEYCODE_DPAD_RIGHT)) dx += 1;
            if (direcoes.contains(KeyEvent.KEYCODE_DPAD_UP)) dy -= 1;
            if (direcoes.contains(KeyEvent.KEYCODE_DPAD_DOWN)) dy += 1;
            if (dx == 0 && dy == 0) { soltar("stick"); return; }
            float n = (float) Math.sqrt(dx * dx + dy * dy);
            Toque t = toques.get("stick");
            if (t == null || t.soltar) { t = new Toque(cx, cy); toques.put("stick", t); }
            t.x = cx + dx / n * r;
            t.y = cy + dy / n * r;
            ciclo();
        } catch (Exception ignora) { }
    }

    private void apertar(String id, float fx, float fy) {
        DisplayMetrics m = tela();
        Toque t = toques.get(id);
        if (t == null || t.soltar) toques.put(id, new Toque(fx * m.widthPixels, fy * m.heightPixels));
        ciclo();
    }

    private void soltar(String id) {
        Toque t = toques.get(id);
        if (t != null) t.soltar = true;
        ciclo();
    }

    private void soltarTudo() {
        direcoes.clear();
        for (Toque t : toques.values()) t.soltar = true;
        ciclo();
    }

    /** Um quadro de toques: todos os dedos ativos continuam (ou terminam) juntos, para segurar botão e mexer o direcional ao mesmo tempo. */
    private void ciclo() {
        if (despachando || toques.isEmpty()) return;
        GestureDescription.Builder b = new GestureDescription.Builder();
        List<String> fim = new ArrayList<String>();
        int n = 0;
        for (Map.Entry<String, Toque> en : toques.entrySet()) {
            if (n >= 9) break;
            Toque t = en.getValue();
            Path p = new Path();
            p.moveTo(t.ultX, t.ultY);
            if (t.x != t.ultX || t.y != t.ultY) p.lineTo(t.x, t.y);
            boolean continua = !t.soltar;
            GestureDescription.StrokeDescription s = t.desc == null ? new GestureDescription.StrokeDescription(p, 0, DURACAO, continua) : t.desc.continueStroke(p, 0, DURACAO, continua);
            t.desc = s;
            t.ultX = t.x; t.ultY = t.y;
            b.addStroke(s);
            if (t.soltar) fim.add(en.getKey());
            n++;
        }
        for (String k : fim) toques.remove(k);
        despachando = true;
        boolean ok = dispatchGesture(b.build(), new GestureResultCallback() {
            @Override public void onCompleted(GestureDescription g) { despachando = false; ciclo(); }
            @Override public void onCancelled(GestureDescription g) { despachando = false; for (Toque t : toques.values()) t.desc = null; ciclo(); }
        }, main);
        if (!ok) despachando = false;
    }

    // ------------------------------------------------------------ editor: arrastar os botões sobre a tela do jogo
    private int dp(float v) { return (int) TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, v, tela()); }

    /** Mostra, por cima do jogo, os pontos do perfil para a pessoa arrastar até os botões da tela do jogo. */
    public String editar(final String perfilId) {
        if (editor != null) return "O editor já está aberto.";
        JSONObject todos = Perfis.carregar(arquivoDePerfis(this));
        JSONObject alvo = null;
        try {
            JSONArray l = todos.getJSONArray("perfis");
            for (int i = 0; i < l.length(); i++) if (l.getJSONObject(i).getString("id").equals(perfilId)) alvo = l.getJSONObject(i);
        } catch (Exception ignora) { }
        if (alvo == null) return "Perfil não encontrado.";
        final JSONObject perfilEditado = alvo;
        final DisplayMetrics m = tela();
        editando = true;
        soltarTudo();
        final FrameLayout f = new FrameLayout(this);
        f.setBackgroundColor(Color.argb(90, 0, 0, 0));
        final Map<String, View> pontos = new HashMap<String, View>();
        try {
            JSONObject d = perfilEditado.getJSONObject("direcional");
            pontos.put("DIRECIONAL", ponto(f, "◎", d.getDouble("cx"), d.getDouble("cy"), 64, m));
            JSONArray bs = perfilEditado.getJSONArray("botoes");
            for (int i = 0; i < bs.length(); i++) { JSONObject b = bs.getJSONObject(i); pontos.put(b.getString("tecla"), ponto(f, b.getString("tecla"), b.getDouble("x"), b.getDouble("y"), 46, m)); }
        } catch (Exception e) { editando = false; return "Perfil inválido."; }
        TextView dica = new TextView(this);
        dica.setText("Arraste cada ponto até o botão do jogo");
        dica.setTextColor(Color.WHITE);
        dica.setBackgroundColor(Color.argb(160, 10, 14, 30));
        dica.setPadding(dp(14), dp(8), dp(14), dp(8));
        f.addView(dica, new FrameLayout.LayoutParams(-2, -2, Gravity.CENTER_HORIZONTAL | Gravity.TOP));
        FrameLayout.LayoutParams pb = new FrameLayout.LayoutParams(-2, -2, Gravity.CENTER_HORIZONTAL | Gravity.BOTTOM);
        pb.setMargins(0, 0, 0, dp(10));
        android.widget.LinearLayout barra = new android.widget.LinearLayout(this);
        Button salvar = new Button(this); salvar.setText("Salvar");
        Button cancelar = new Button(this); cancelar.setText("Cancelar");
        barra.addView(cancelar); barra.addView(salvar);
        f.addView(barra, pb);
        cancelar.setOnClickListener(new View.OnClickListener() { public void onClick(View v) { fecharEditor(); } });
        salvar.setOnClickListener(new View.OnClickListener() {
            public void onClick(View v) {
                try {
                    JSONObject d = perfilEditado.getJSONObject("direcional");
                    View dv = pontos.get("DIRECIONAL");
                    d.put("cx", (dv.getX() + dv.getWidth() / 2f) / m.widthPixels).put("cy", (dv.getY() + dv.getHeight() / 2f) / m.heightPixels);
                    JSONArray bs = perfilEditado.getJSONArray("botoes");
                    for (int i = 0; i < bs.length(); i++) {
                        JSONObject b = bs.getJSONObject(i);
                        View pv = pontos.get(b.getString("tecla"));
                        b.put("x", (pv.getX() + pv.getWidth() / 2f) / m.widthPixels).put("y", (pv.getY() + pv.getHeight() / 2f) / m.heightPixels);
                    }
                    Perfis.guardarPerfil(arquivoDePerfis(ControleService.this), perfilEditado);
                    recarregar();
                } catch (Exception ignora) { }
                fecharEditor();
            }
        });
        WindowManager wm = (WindowManager) getSystemService(WINDOW_SERVICE);
        WindowManager.LayoutParams lp = new WindowManager.LayoutParams(-1, -1, WindowManager.LayoutParams.TYPE_ACCESSIBILITY_OVERLAY, WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN | WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE, PixelFormat.TRANSLUCENT);
        wm.addView(f, lp);
        editor = f;
        return null;
    }

    private View ponto(FrameLayout f, String rotulo, double fx, double fy, int tam, DisplayMetrics m) {
        final TextView v = new TextView(this);
        v.setText(rotulo);
        v.setTextColor(Color.WHITE);
        v.setGravity(Gravity.CENTER);
        v.setTextSize(13);
        GradientDrawable g = new GradientDrawable();
        g.setShape(GradientDrawable.OVAL);
        g.setColor(Color.argb(150, 80, 60, 200));
        g.setStroke(dp(2), Color.argb(230, 25, 227, 255));
        v.setBackground(g);
        FrameLayout.LayoutParams lp = new FrameLayout.LayoutParams(dp(tam), dp(tam));
        f.addView(v, lp);
        v.setX((float) (fx * m.widthPixels) - dp(tam) / 2f);
        v.setY((float) (fy * m.heightPixels) - dp(tam) / 2f);
        v.setOnTouchListener(new View.OnTouchListener() {
            float dx, dy;
            public boolean onTouch(View view, MotionEvent ev) {
                if (ev.getActionMasked() == MotionEvent.ACTION_DOWN) { dx = view.getX() - ev.getRawX(); dy = view.getY() - ev.getRawY(); }
                else if (ev.getActionMasked() == MotionEvent.ACTION_MOVE) { view.setX(ev.getRawX() + dx); view.setY(ev.getRawY() + dy); }
                return true;
            }
        });
        return v;
    }

    private void fecharEditor() {
        if (editor != null) { try { ((WindowManager) getSystemService(WINDOW_SERVICE)).removeView(editor); } catch (Exception ignora) { } editor = null; }
        editando = false;
    }
}

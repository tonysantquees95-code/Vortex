package tech.vetorial.vortex;

import android.graphics.Color;
import android.os.Bundle;
import android.view.View;
import android.view.Window;

import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;

import com.getcapacitor.BridgeActivity;
import com.getcapacitor.CapConfig;

import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;

/**
 * O Voxix (chat) dentro do Vortex: uma tela à parte, com cartão próprio na lista de apps recentes (taskAffinity no manifesto),
 * para o Vortex continuar aberto e dar para usar os dois (trocando de tela ou em tela dividida). Carrega a página voxix.html
 * do mesmo pacote e mantém o app ENTRE as barras do Android, igual à tela do Vortex.
 */
public class VoxixActivity extends BridgeActivity {
    private static final int FUNDO = Color.parseColor("#05070D");

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // mesma configuração do Capacitor, só que abrindo em voxix.html em vez de index.html
        try {
            InputStream in = getAssets().open("capacitor.config.json");
            ByteArrayOutputStream saida = new ByteArrayOutputStream();
            byte[] bloco = new byte[4096];
            int n;
            while ((n = in.read(bloco)) > 0) saida.write(bloco, 0, n);
            in.close();
            JSONObject json = new JSONObject(new String(saida.toByteArray(), "UTF-8"));
            JSONObject servidor = json.optJSONObject("server");
            if (servidor == null) { servidor = new JSONObject(); json.put("server", servidor); }
            servidor.put("appStartPath", "voxix.html");
            this.config = new CapConfig(getAssets(), json);
        } catch (Exception e) {
            // sem a configuração própria o Capacitor abriria o Vortex aqui; melhor fechar do que mostrar a tela errada
            finish();
            return;
        }
        super.onCreate(savedInstanceState);

        Window w = getWindow();
        WindowCompat.setDecorFitsSystemWindows(w, false);
        w.setStatusBarColor(Color.TRANSPARENT);
        w.setNavigationBarColor(Color.TRANSPARENT);
        w.getDecorView().setBackgroundColor(FUNDO);
        WindowInsetsControllerCompat c = WindowCompat.getInsetsController(w, w.getDecorView());
        c.setAppearanceLightStatusBars(false);
        c.setAppearanceLightNavigationBars(false);

        final View raiz = findViewById(android.R.id.content);
        raiz.setBackgroundColor(FUNDO);
        ViewCompat.setOnApplyWindowInsetsListener(raiz, (v, insets) -> {
            Insets barras = insets.getInsets(WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout());
            Insets teclado = insets.getInsets(WindowInsetsCompat.Type.ime());
            v.setPadding(barras.left, barras.top, barras.right, Math.max(barras.bottom, teclado.bottom));
            return WindowInsetsCompat.CONSUMED;
        });
        ViewCompat.requestApplyInsets(raiz);
    }
}

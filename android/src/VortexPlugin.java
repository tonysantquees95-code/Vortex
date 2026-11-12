package tech.vetorial.vortex;

import android.app.Activity;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.DocumentsContract;
import android.provider.Settings;

import androidx.activity.result.ActivityResult;
import androidx.core.content.FileProvider;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.File;

/** Ponte do Android: recebe {comando, args} da interface e responde com o mesmo JSON do motor em Rust. */
@CapacitorPlugin(name = "Vortex")
public class VortexPlugin extends Plugin {
    private final Motor motor = new Motor(new Motor.Relogio() { public long agora() { return System.currentTimeMillis() / 1000; } });

    /** Jogo aberto agora; quando o Vortex volta para a frente, a sessão fecha e o tempo é somado. */
    private static String jogoAberto = null;
    private static long abertoEm = 0;

    // id, nome, pacotes, plataformas (vazio = só via RetroArch), método ("retroarch", "view"), atividade
    private static final String[][] EMULADORES = {
            {"retroarch", "RetroArch", "com.retroarch.aarch64,com.retroarch,com.retroarch.ra32", "", "retroarch", "com.retroarch.browser.retroactivity.RetroActivityFuture"},
            {"ppsspp", "PPSSPP", "org.ppsspp.ppsspp,org.ppsspp.ppssppgold", "psp", "view", "org.ppsspp.ppsspp.PpssppActivity"},
            {"dolphin", "Dolphin", "org.dolphinemu.dolphinemu", "gamecube,wii", "view", "org.dolphinemu.dolphinemu.ui.main.MainActivity"},
            {"duckstation", "DuckStation", "com.github.stenzek.duckstation", "ps1", "view", ""},
            {"nethersx2", "NetherSX2/AetherSX2", "xyz.aethersx2.android,xyz.aethersx2.custom", "ps2", "view", ""},
            {"flycast", "Flycast", "com.flycast.emulator", "dreamcast", "view", ""},
            {"melonds", "melonDS", "me.magnum.melonds", "nds", "view", ""},
            {"mupen", "M64Plus FZ", "org.mupen64plusae.v3.fzurita,org.mupen64plusae.v3.fzurita.pro", "n64", "view", ""},
            {"citra", "Citra/Lime3DS", "org.citra.emu,io.github.lime3ds.android,org.azahar_emu.azahar", "3ds", "view", ""},
            {"yuzu", "Sudachi/Yuzu (Switch)", "org.sudachi.sudachi_emu,org.yuzu.yuzu_emu", "switch", "view", ""},
    };

    private String instalado(String[] e) {
        PackageManager pm = getContext().getPackageManager();
        for (String pacote : e[2].split(",")) {
            try { pm.getPackageInfo(pacote, 0); return pacote; } catch (PackageManager.NameNotFoundException ignora) { }
        }
        return null;
    }

    @PluginMethod
    public void motor(final PluginCall call) {
        final String comando = call.getString("comando", "");
        final String args = call.getString("args", "{}");
        getBridge().execute(new Runnable() {
            @Override
            public void run() {
                try {
                    JSONObject a = new JSONObject(args);
                    a.put("biblioteca", new File(getContext().getFilesDir(), "vortex/biblioteca.json").getAbsolutePath());
                    if (comando.startsWith("loja_")) a.put("catalogo_json", lerCatalogo());
                    Object r;
                    if (comando.equals("emuladores")) r = emuladores();
                    else if (comando.startsWith("controle_")) r = controle(comando, a);
                    else if (comando.startsWith("conta_") || comando.equals("saves_sincronizar")) r = contaESaves(comando, a);
                    else if (comando.equals("preparar_jogo")) r = preparar(a);
                    else if (comando.equals("lancar")) r = lancar(a);
                    else r = motor.executar(comando, a);
                    JSObject saida = new JSObject();
                    saida.put("resultado", String.valueOf(r));
                    call.resolve(saida);
                } catch (Exception e) {
                    call.reject(e.getMessage() == null ? e.toString() : e.getMessage());
                }
            }
        });
    }

    /** Conta Vetorial ID e saves na nuvem. */
    private Object contaESaves(String comando, JSONObject a) throws Exception {
        File dados = new File(getContext().getFilesDir(), "vortex");
        Nuvem.Rede rede = new Nuvem.RedeReal();
        switch (comando) {
            case "conta_estado": return Nuvem.estado(rede, dados);
            case "conta_entrar": return Nuvem.entrar(rede, dados, a.getString("email"), a.getString("senha"), a.optString("aparelho", "Celular Android"));
            case "conta_sair": Nuvem.sair(rede, dados); return new JSONObject().put("logado", false);
            case "saves_sincronizar": {
                Object lista = motor.executar("listar", new JSONObject().put("biblioteca", a.getString("biblioteca")).put("filtro", new JSONObject()));
                JSONArray jogos = lista instanceof JSONArray ? (JSONArray) lista : new JSONArray(String.valueOf(lista));
                return Nuvem.sincronizar(rede, dados, Nuvem.itensDaBiblioteca(jogos, new File(getContext().getFilesDir(), "saves")), a.optString("conflitos", "perguntar"));
            }
            default: throw new Exception("Comando desconhecido: " + comando);
        }
    }

    private File arquivoPerfis() { return ControleService.arquivoDePerfis(getContext()); }

    private boolean servicoAtivo() { return ControleService.instancia != null; }

    /** Jogos nativos de Android e perfis de controle (modelos, salvar, ativar, posicionar os botões na tela do jogo). */
    private Object controle(String comando, JSONObject a) throws Exception {
        PackageManager pm = getContext().getPackageManager();
        switch (comando) {
            case "controle_jogos": {
                JSONArray r = new JSONArray();
                for (android.content.pm.ApplicationInfo ai : pm.getInstalledApplications(0)) {
                    boolean jogo = Build.VERSION.SDK_INT >= 26 ? ai.category == android.content.pm.ApplicationInfo.CATEGORY_GAME : (ai.flags & android.content.pm.ApplicationInfo.FLAG_IS_GAME) != 0;
                    if (!jogo || (ai.flags & android.content.pm.ApplicationInfo.FLAG_SYSTEM) != 0 || ai.packageName.equals(getContext().getPackageName())) continue;
                    if (pm.getLaunchIntentForPackage(ai.packageName) == null) continue;
                    r.put(new JSONObject().put("pacote", ai.packageName).put("nome", String.valueOf(pm.getApplicationLabel(ai))));
                }
                return r;
            }
            case "controle_estado": return new JSONObject().put("servico", servicoAtivo());
            case "controle_abrir_acessibilidade": {
                Intent i = new Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS);
                i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                getContext().startActivity(i);
                return new JSONObject().put("ok", true);
            }
            case "controle_modelos": return Perfis.modelos();
            case "controle_perfis": return Perfis.carregar(arquivoPerfis());
            case "controle_novo": {
                JSONObject p = Perfis.novo(a.getString("pacote"), a.optString("nome", ""), a.optString("modelo", "acao"), System.currentTimeMillis() / 1000);
                { JSONObject g = Perfis.guardarPerfil(arquivoPerfis(), p); if (servicoAtivo()) ControleService.instancia.recarregar(); return g; }
            }
            case "controle_salvar": return Perfis.guardarPerfil(arquivoPerfis(), a.getJSONObject("perfil"));
            case "controle_apagar": { Perfis.apagarPerfil(arquivoPerfis(), a.getString("id")); if (servicoAtivo()) ControleService.instancia.recarregar(); return new JSONObject().put("ok", true); }
            case "controle_ativar": { Perfis.ativar(arquivoPerfis(), a.getString("pacote"), a.getString("id")); if (servicoAtivo()) ControleService.instancia.recarregar(); return new JSONObject().put("ok", true); }
            case "controle_jogar": {
                Intent i = pm.getLaunchIntentForPackage(a.getString("pacote"));
                if (i == null) throw new Exception("Esse jogo não está mais instalado.");
                i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                getContext().startActivity(i);
                return new JSONObject().put("servico", servicoAtivo());
            }
            case "controle_editar": {
                if (!servicoAtivo()) throw new Exception("Ative o serviço “Vortex Controle” nas configurações de acessibilidade para posicionar os botões.");
                Intent i = pm.getLaunchIntentForPackage(a.getString("pacote"));
                if (i == null) throw new Exception("Esse jogo não está mais instalado.");
                i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                getContext().startActivity(i);
                final String perfilId = a.getString("id");
                new android.os.Handler(android.os.Looper.getMainLooper()).postDelayed(new Runnable() {
                    public void run() { if (ControleService.instancia != null) ControleService.instancia.editar(perfilId); }
                }, 2500);
                return new JSONObject().put("ok", true);
            }
            default: throw new Exception("Comando desconhecido: " + comando);
        }
    }

    private String lerCatalogo() throws Exception {
        try (java.io.InputStream in = getContext().getAssets().open("catalogo.json")) {
            java.io.ByteArrayOutputStream o = new java.io.ByteArrayOutputStream();
            byte[] buf = new byte[8192]; int n;
            while ((n = in.read(buf)) > 0) o.write(buf, 0, n);
            return o.toString("UTF-8");
        }
    }

    private JSONObject emuladores() throws Exception {
        JSONArray l = new JSONArray();
        for (String[] e : EMULADORES) {
            if (instalado(e) == null) continue;
            JSONArray ps = new JSONArray();
            if (e[3].isEmpty()) { for (Plataformas.P p : Plataformas.TODAS) if (p.nucleos.length > 0) ps.put(p.id); }
            else for (String p : e[3].split(",")) ps.put(p);
            l.put(new JSONObject().put("id", e[0]).put("nome", e[1]).put("plataformas", ps));
        }
        return new JSONObject().put("instalados", l);
    }

    /** Baixa o núcleo de emulação do console do jogo (só na primeira vez). */
    private JSONObject preparar(JSONObject a) throws Exception {
        JSONObject j = (JSONObject) motor.executar("jogo", a);
        Plataformas.P p = Plataformas.porId(j.getString("plataforma"));
        if (p == null || p.nucleos.length == 0) throw new Exception("Esse console ainda não tem motor embutido no Vortex.");
        boolean baixou = NucleosAndroid.garantir(getContext(), p.nucleos[0]);
        return new JSONObject().put("nucleo", p.nucleos[0]).put("baixou", baixou);
    }

    /** Escolhe o emulador (o específico da plataforma, senão o RetroArch) e abre o jogo nele. */
    private JSONObject lancar(JSONObject a) throws Exception {
        JSONObject j = (JSONObject) motor.executar("jogo", a);
        String plat = j.getString("plataforma");
        File rom = new File(j.getString("caminho"));
        if (!rom.isFile()) throw new Exception("O arquivo deste jogo não foi encontrado.");
        Plataformas.P p = Plataformas.porId(plat);
        // preferência: o motor embutido do próprio Vortex (sem instalar emulador)
        if (p != null && p.nucleos.length > 0 && NucleosAndroid.arquivo(getContext(), p.nucleos[0]).isFile()) {
            Intent jogo = new Intent(getContext(), JogoActivity.class);
            jogo.putExtra("rom", rom.getAbsolutePath()).putExtra("nucleo", p.nucleos[0]).putExtra("id", j.getString("id"));
            jogo.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(jogo);
            motor.executar("sessao_iniciar", new JSONObject().put("biblioteca", a.getString("biblioteca")).put("id", j.getString("id")));
            jogoAberto = j.getString("id");
            abertoEm = System.currentTimeMillis();
            return new JSONObject().put("pid", 0).put("emulador", "Vortex").put("nucleo", p.nucleos[0]).put("modo_jogo", false);
        }
        String[] escolhido = null;
        String pacote = null;
        for (String[] e : EMULADORES) {
            if (e[3].isEmpty() || !java.util.Arrays.asList(e[3].split(",")).contains(plat)) continue;
            pacote = instalado(e);
            if (pacote != null) { escolhido = e; break; }
        }
        if (escolhido == null && p != null && p.nucleos.length > 0) {
            pacote = instalado(EMULADORES[0]);
            if (pacote != null) escolhido = EMULADORES[0];
        }
        if (escolhido == null) throw new Exception("Nenhum emulador instalado para " + (p == null ? plat : p.nome) + ". Instale o RetroArch (ou um emulador próprio desse console) e tente de novo.");

        Intent it;
        if (escolhido[4].equals("retroarch")) {
            it = new Intent(Intent.ACTION_MAIN);
            it.setComponent(new ComponentName(pacote, escolhido[5]));
            it.putExtra("ROM", rom.getAbsolutePath());
            String nucleo = p.nucleos[0];
            it.putExtra("LIBRETRO", "/data/data/" + pacote + "/cores/" + nucleo + "_android.so");
            it.putExtra("CONFIGFILE", "/storage/emulated/0/Android/data/" + pacote + "/files/retroarch.cfg");
            it.putExtra("QUITFOCUS", "");
        } else {
            Uri uri = FileProvider.getUriForFile(getContext(), getContext().getPackageName() + ".fileprovider", rom);
            it = new Intent(Intent.ACTION_VIEW);
            it.setDataAndType(uri, "application/octet-stream");
            it.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            if (!escolhido[5].isEmpty()) it.setComponent(new ComponentName(pacote, escolhido[5])); else it.setPackage(pacote);
        }
        it.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        getContext().startActivity(it);

        JSONObject ini = new JSONObject().put("biblioteca", a.getString("biblioteca")).put("id", j.getString("id"));
        motor.executar("sessao_iniciar", ini);
        jogoAberto = j.getString("id");
        abertoEm = System.currentTimeMillis();
        return new JSONObject().put("pid", 0).put("emulador", escolhido[1]).put("nucleo", escolhido[4].equals("retroarch") ? p.nucleos[0] : JSONObject.NULL).put("modo_jogo", false);
    }

    /** Voltou para o Vortex: o jogo fechou (ou o jogador voltou), então fecha a sessão. */
    @Override
    protected void handleOnResume() {
        super.handleOnResume();
        final String id = jogoAberto;
        if (id == null || System.currentTimeMillis() - abertoEm < 4000) return; // a própria abertura do emulador também faz "resume"
        jogoAberto = null;
        getBridge().execute(new Runnable() {
            public void run() {
                try {
                    motor.executar("sessao_encerrar", new JSONObject().put("biblioteca", new File(getContext().getFilesDir(), "vortex/biblioteca.json").getAbsolutePath()).put("id", id));
                } catch (Exception ignora) { }
            }
        });
    }

    // ------------------------------------------------------------ pastas e permissão de arquivos
    private boolean temAcessoATudo() {
        return Build.VERSION.SDK_INT < Build.VERSION_CODES.R || Environment.isExternalStorageManager();
    }

    private void pedirAcessoATudo() {
        try {
            Intent i = new Intent(Settings.ACTION_MANAGE_APP_ALL_FILES_ACCESS_PERMISSION, Uri.parse("package:" + getContext().getPackageName()));
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(i);
        } catch (Exception e) {
            Intent i = new Intent(Settings.ACTION_MANAGE_ALL_FILES_ACCESS_PERMISSION);
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(i);
        }
    }

    @PluginMethod
    public void escolherPasta(PluginCall call) {
        if (!temAcessoATudo()) {
            pedirAcessoATudo();
            call.reject("Libere “Acesso a todos os arquivos” para o Vortex nas configurações que abriram e tente de novo.");
            return;
        }
        Intent i = new Intent(Intent.ACTION_OPEN_DOCUMENT_TREE);
        startActivityForResult(call, i, "pastaEscolhida");
    }

    @ActivityCallback
    private void pastaEscolhida(PluginCall call, ActivityResult r) {
        JSObject saida = new JSObject();
        if (call == null) return;
        if (r.getResultCode() != Activity.RESULT_OK || r.getData() == null || r.getData().getData() == null) {
            saida.put("pasta", JSObject.NULL);
            call.resolve(saida);
            return;
        }
        String caminho = Motor.caminhoDaArvore(DocumentsContract.getTreeDocumentId(r.getData().getData()));
        if (caminho == null) { call.reject("Não consegui entender essa pasta. Escolha uma pasta do armazenamento do aparelho ou do cartão."); return; }
        saida.put("pasta", caminho);
        call.resolve(saida);
    }
}

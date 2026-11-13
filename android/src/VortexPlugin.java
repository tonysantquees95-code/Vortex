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
                    // sem “Acesso a todos os arquivos” o Android mostra as pastas vazias e a busca não acha nada: avisa em vez de falhar calada
                    if ((comando.equals("organizar") || comando.equals("organizar_candidatos") || comando.equals("escanear") || comando.equals("limpar") || comando.equals("adicionar_pasta")) && !temAcessoATudo()) {
                        pedirAcessoATudo();
                        call.reject("Para achar seus jogos o Vortex precisa de “Acesso a todos os arquivos”. Liberei a tela de permissão: ligue para o Vortex, volte e toque em procurar de novo.");
                        return;
                    }
                    Object r;
                    if (comando.equals("emuladores")) r = emuladores();
                    else if (comando.startsWith("controle_") || comando.equals("apps_android")) r = controle(comando, a);
                    else if (comando.startsWith("conta_") || comando.startsWith("ponte_") || comando.equals("saves_sincronizar") || comando.equals("saves_lista") || comando.equals("conta_pedir")) r = contaESaves(comando, a);
                    else if (comando.equals("preparar_jogo")) r = preparar(a);
                    else if (comando.equals("lancar")) r = lancar(a);
                    else if (comando.equals("indice_capas")) r = indiceCapas(a.getString("sistema"));
                    else if (comando.equals("abrir_pasta")) r = abrirPasta(a);
                    else if (comando.equals("abrir_url")) r = abrirUrl(a);
                    else if (comando.equals("visual_controles")) r = JogoActivity.gravarVisual(getContext(), a);
                    else if (comando.equals("gamebar")) r = a.has("definir") ? GameBar.gravar(getContext(), a.getJSONObject("definir")) : GameBar.ler(getContext());
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

    /** Lista dos nomes de capa que existem no repositório da Libretro para um sistema (guardada por 14 dias). Sem ela só dá para adivinhar o nome do arquivo. */
    private Object indiceCapas(String sistema) throws Exception {
        if (!sistema.matches("[A-Za-z0-9 ._+-]{3,60}")) throw new Exception("sistema inválido");
        File cache = new File(getContext().getFilesDir(), "capas_" + sistema.replaceAll("[^A-Za-z0-9]", "_") + ".json");
        if (cache.isFile() && System.currentTimeMillis() - cache.lastModified() < 14L * 24 * 3600 * 1000) {
            return new String(java.nio.file.Files.readAllBytes(cache.toPath()), "UTF-8");
        }
        java.net.HttpURLConnection h = (java.net.HttpURLConnection) new java.net.URL("https://thumbnails.libretro.com/" + sistema.replace(" ", "%20") + "/Named_Boxarts/").openConnection();
        h.setConnectTimeout(15000);
        h.setReadTimeout(60000);
        h.setRequestProperty("User-Agent", "Vortex");
        org.json.JSONArray nomes = new org.json.JSONArray();
        try {
            if (h.getResponseCode() != 200) throw new Exception("lista de capas indisponível (erro " + h.getResponseCode() + ")");
            java.io.BufferedReader l = new java.io.BufferedReader(new java.io.InputStreamReader(h.getInputStream(), "UTF-8"));
            java.util.regex.Pattern re = java.util.regex.Pattern.compile("href=\"([^\"]+?)\\.png\"");
            String linha;
            while ((linha = l.readLine()) != null) {
                java.util.regex.Matcher m = re.matcher(linha);
                while (m.find()) {
                    String n = m.group(1).replace("&amp;", "&").replace("+", "%2B");
                    try { nomes.put(java.net.URLDecoder.decode(n, "UTF-8")); } catch (Exception ignora) { }
                }
            }
        } finally { h.disconnect(); }
        if (nomes.length() == 0) throw new Exception("lista de capas vazia");
        String texto = nomes.toString();
        try (java.io.FileOutputStream o = new java.io.FileOutputStream(cache)) { o.write(texto.getBytes("UTF-8")); } catch (Exception ignora) { }
        return texto;
    }

    /** Conta Vetorial ID e saves na nuvem. */
    private Object contaESaves(String comando, JSONObject a) throws Exception {
        File dados = new File(getContext().getFilesDir(), "vortex");
        Nuvem.Rede rede = new Nuvem.RedeReal();
        switch (comando) {
            case "conta_estado": return Nuvem.estado(rede, dados);
            case "conta_entrar": return Nuvem.entrar(rede, dados, a.getString("email"), a.getString("senha"), a.optString("aparelho", "Celular Android"));
            case "conta_sair": Nuvem.sair(rede, dados); return new JSONObject().put("logado", false);
            case "ponte_fila": return Nuvem.fila(rede, dados);
            case "ponte_responder": Nuvem.responder(rede, dados, a.getString("id"), a.optBoolean("ok", true), a.optString("resumo", "")); return new JSONObject().put("ok", true);
            case "conta_pedir": {
                String caminho = a.getString("caminho"), metodo = a.optString("metodo", "GET");
                if (!(caminho.equals("/vortex/steam") || caminho.startsWith("/vortex/steam/")) || !(metodo.equals("GET") || metodo.equals("POST") || metodo.equals("DELETE"))) throw new Exception("Pedido não permitido.");
                return Nuvem.pedirAoServidor(rede, dados, metodo, caminho);
            }
            case "saves_lista": return Nuvem.listaDeSaves(rede, dados);
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

    /** Abre um endereço https no navegador. */
    private Object abrirUrl(JSONObject a) throws Exception {
        String url = a.optString("url", "");
        if (!url.startsWith("https://") || url.length() > 600) throw new Exception("Endereço inválido.");
        Intent i = new Intent(Intent.ACTION_VIEW, android.net.Uri.parse(url));
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        getContext().startActivity(i);
        return new JSONObject().put("aberto", true);
    }

    /** Abre o Vindex (gerenciador de arquivos da Vetorial) direto numa pasta. Sem o Vindex instalado, devolve vindex=false. */
    private Object abrirPasta(JSONObject a) throws Exception {
        String pasta = a.optString("pasta", "");
        if (pasta.isEmpty()) throw new Exception("Qual pasta abrir?");
        new File(pasta).mkdirs();
        Intent i = getContext().getPackageManager().getLaunchIntentForPackage("tech.vetorial.vindex");
        if (i == null) return new JSONObject().put("vindex", false);
        i.putExtra("vindex_pasta", pasta);
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        getContext().startActivity(i);
        return new JSONObject().put("vindex", true);
    }

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
            case "apps_android": {
                // jogos de Android instalados, com o ícone de cada um (para a biblioteca "Android" do Vortex)
                JSONArray r = new JSONArray();
                for (android.content.pm.ApplicationInfo ai : pm.getInstalledApplications(0)) {
                    boolean jogo = Build.VERSION.SDK_INT >= 26 ? ai.category == android.content.pm.ApplicationInfo.CATEGORY_GAME : (ai.flags & android.content.pm.ApplicationInfo.FLAG_IS_GAME) != 0;
                    if (!jogo || (ai.flags & android.content.pm.ApplicationInfo.FLAG_SYSTEM) != 0 || ai.packageName.equals(getContext().getPackageName())) continue;
                    if (pm.getLaunchIntentForPackage(ai.packageName) == null) continue;
                    String icone = "";
                    try {
                        android.graphics.drawable.Drawable d = pm.getApplicationIcon(ai);
                        android.graphics.Bitmap bmp = android.graphics.Bitmap.createBitmap(128, 128, android.graphics.Bitmap.Config.ARGB_8888);
                        android.graphics.Canvas cv = new android.graphics.Canvas(bmp);
                        d.setBounds(0, 0, 128, 128); d.draw(cv);
                        java.io.ByteArrayOutputStream bo = new java.io.ByteArrayOutputStream();
                        bmp.compress(android.graphics.Bitmap.CompressFormat.PNG, 90, bo);
                        icone = "data:image/png;base64," + android.util.Base64.encodeToString(bo.toByteArray(), android.util.Base64.NO_WRAP);
                    } catch (Throwable ignora) { }
                    r.put(new JSONObject().put("pacote", ai.packageName).put("nome", String.valueOf(pm.getApplicationLabel(ai))).put("icone", icone));
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
        if (NucleosAndroid.garantirSistema(getContext(), p.nucleos[0])) baixou = true;
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
    public void instalarAtualizacao(final PluginCall call) {
        final String url = call.getString("url", "");
        final String sha = call.getString("sha256", "");
        final boolean https = url.startsWith("https://");
        String host = "";
        try { host = new java.net.URL(url).getHost().toLowerCase(java.util.Locale.ROOT); } catch (Exception e) { /* url inválida */ }
        if (!https || !(host.equals("github.com") || host.endsWith(".githubusercontent.com") || host.endsWith(".github.com"))) {
            call.reject("Endereço de atualização não permitido.");
            return;
        }
        if (!podeInstalar()) {
            pedirTelaInstalar();
            call.reject("Libere “Instalar apps desconhecidos” para o Vortex na tela que abriu e toque em Atualizar de novo.");
            return;
        }
        getBridge().execute(new Runnable() {
            @Override
            public void run() {
                try {
                    File apk = new File(getContext().getCacheDir(), "vortex-atualizacao.apk");
                    java.net.HttpURLConnection c = (java.net.HttpURLConnection) new java.net.URL(url).openConnection();
                    c.setConnectTimeout(20_000);
                    c.setReadTimeout(60_000);
                    if (c.getResponseCode() != 200) throw new Exception("O download falhou (" + c.getResponseCode() + ").");
                    java.security.MessageDigest md = java.security.MessageDigest.getInstance("SHA-256");
                    java.io.InputStream in = c.getInputStream();
                    java.io.FileOutputStream out = new java.io.FileOutputStream(apk);
                    try {
                        byte[] b = new byte[64 * 1024];
                        int n;
                        while ((n = in.read(b)) > 0) { out.write(b, 0, n); md.update(b, 0, n); }
                    } finally { out.close(); in.close(); c.disconnect(); }
                    StringBuilder hex = new StringBuilder();
                    for (byte x : md.digest()) hex.append(String.format("%02x", x));
                    if (!sha.isEmpty() && !sha.equalsIgnoreCase(hex.toString())) { apk.delete(); throw new Exception("O arquivo baixado não confere com o publicado. Nada foi instalado."); }

                    // abre a tela de instalação do próprio Android (mais confiável que a sessão do instalador, que às vezes não mostra a confirmação)
                    final android.net.Uri uri = androidx.core.content.FileProvider.getUriForFile(getContext(), getContext().getPackageName() + ".fileprovider", apk);
                    final Intent it = new Intent(Intent.ACTION_VIEW);
                    it.setDataAndType(uri, "application/vnd.android.package-archive");
                    it.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
                    getActivity().runOnUiThread(new Runnable() {
                        @Override
                        public void run() {
                            try { getContext().startActivity(it); call.resolve(); }
                            catch (Exception e) { call.reject("Não consegui abrir a instalação: " + e.getMessage()); }
                        }
                    });
                    return;

                } catch (Exception e) {
                    call.reject(e.getMessage() == null ? e.toString() : e.getMessage());
                }
            }
        });
    }

    private boolean podeInstalar() {
        return Build.VERSION.SDK_INT < Build.VERSION_CODES.O || getContext().getPackageManager().canRequestPackageInstalls();
    }

    private void pedirTelaInstalar() {
        try {
            Intent i = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:" + getContext().getPackageName()));
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(i);
        } catch (Exception e) {
            Intent i = new Intent(Settings.ACTION_SECURITY_SETTINGS);
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(i);
        }
    }

    private JSONObject permissao(String id, String titulo, String motivo, boolean obrigatoria, boolean concedida) throws Exception {
        return new JSONObject().put("id", id).put("titulo", titulo).put("motivo", motivo).put("obrigatoria", obrigatoria).put("concedida", concedida);
    }

    @PluginMethod
    public void permissoes(PluginCall call) {
        try {
            JSONArray l = new JSONArray();
            l.put(permissao("arquivos", "Acesso a todos os arquivos", "Para achar os seus jogos retrô no aparelho (Roms, Download, cartão SD) e guardar cada um na pasta do console.", true, temAcessoATudo()));
            l.put(permissao("controle", "Serviço de controle (acessibilidade)", "Opcional: transforma os botões do controle em toques na tela dos jogos de Android que não têm suporte a controle. Não lê o conteúdo da tela.", false, servicoAtivo()));
            l.put(permissao("instalar", "Instalar apps desconhecidos", "Opcional: deixa o Vortex abrir a instalação das próprias atualizações.", false, podeInstalar()));
            JSObject r = new JSObject();
            r.put("lista", l);
            call.resolve(r);
        } catch (Exception e) {
            call.reject(String.valueOf(e.getMessage()));
        }
    }

    @PluginMethod
    public void pedirPermissao(PluginCall call) {
        String id = call.getString("id", "");
        try {
            if ("arquivos".equals(id)) pedirAcessoATudo();
            else if ("instalar".equals(id)) pedirTelaInstalar();
            else if ("controle".equals(id)) {
                Intent i = new Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS);
                i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                getContext().startActivity(i);
            } else { call.reject("Permissão desconhecida."); return; }
            call.resolve();
        } catch (Exception e) {
            call.reject(String.valueOf(e.getMessage()));
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

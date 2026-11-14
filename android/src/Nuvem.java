package tech.vetorial.vortex;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.StandardCopyOption;
import java.security.MessageDigest;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/** Conta Vetorial ID e saves na nuvem (mesmas regras do núcleo em Rust: nada é apagado sem avisar, conflito vai para a pessoa). */
public final class Nuvem {
    public static final String SERVIDOR = "https://venus-servidor.tonysantquees95.workers.dev";

    public static final class Resposta {
        public final int status; public final byte[] corpo; public final long versao;
        public Resposta(int status, byte[] corpo, long versao) { this.status = status; this.corpo = corpo; this.versao = versao; }
        public String texto() { return new String(corpo, StandardCharsets.UTF_8); }
    }

    public interface Rede { Resposta pedir(String metodo, String caminho, String token, byte[] corpo, Long base) throws Exception; }

    public static final class RedeReal implements Rede {
        @Override public Resposta pedir(String metodo, String caminho, String token, byte[] corpo, Long base) throws Exception {
            HttpURLConnection c = (HttpURLConnection) new URL(SERVIDOR + caminho).openConnection();
            c.setConnectTimeout(15000); c.setReadTimeout(30000);
            c.setRequestMethod(metodo);
            if (token != null) c.setRequestProperty("Authorization", "Bearer " + token);
            if (base != null) c.setRequestProperty("x-base", String.valueOf(base));
            if (corpo != null) { c.setDoOutput(true); c.setRequestProperty("Content-Type", "application/octet-stream"); c.getOutputStream().write(corpo); }
            int status;
            try { status = c.getResponseCode(); } catch (java.io.IOException e) { throw new Exception("Sem conexão com o servidor da Vetorial."); }
            InputStream in = status >= 400 ? c.getErrorStream() : c.getInputStream();
            ByteArrayOutputStream o = new ByteArrayOutputStream();
            if (in != null) { byte[] b = new byte[8192]; int n; while ((n = in.read(b)) > 0 && o.size() < 9 * 1024 * 1024) o.write(b, 0, n); }
            String v = c.getHeaderField("x-versao");
            return new Resposta(status, o.toByteArray(), v == null ? -1 : Long.parseLong(v));
        }
    }

    public static final class Item {
        public final String jogo, arquivo; public final File caminho;
        public Item(String jogo, String arquivo, File caminho) { this.jogo = jogo; this.arquivo = arquivo; this.caminho = caminho; }
    }

    private static String mensagem(Resposta r) {
        try { String e = new JSONObject(r.texto()).optString("error", ""); if (!e.isEmpty()) return e; } catch (Exception ignora) { }
        return "O servidor respondeu " + r.status + ".";
    }

    /** Nome do jogo igual em todos os aparelhos: console + nome do arquivo. */
    public static String chaveDoJogo(String plataforma, String nomeDoArquivo) {
        StringBuilder s = new StringBuilder();
        for (char c : nomeDoArquivo.toLowerCase(Locale.ROOT).toCharArray()) {
            char x = (c >= 'a' && c <= 'z') || (c >= '0' && c <= '9') ? c : '-';
            if (x == '-' && (s.length() == 0 || s.charAt(s.length() - 1) == '-')) continue;
            s.append(x);
        }
        while (s.length() > 0 && s.charAt(s.length() - 1) == '-') s.setLength(s.length() - 1);
        String k = plataforma + "-" + s;
        if (k.length() > 60) k = k.substring(0, 60);
        while (k.endsWith("-")) k = k.substring(0, k.length() - 1);
        return k;
    }

    static String sha(byte[] d) throws Exception {
        StringBuilder b = new StringBuilder();
        for (byte x : MessageDigest.getInstance("SHA-256").digest(d)) b.append(String.format("%02x", x));
        return b.toString();
    }

    /** Identificador estável do aparelho. */
    public static String idDoAparelho(File dados) throws Exception {
        File f = new File(dados, "aparelho.id");
        if (f.isFile()) { String t = new String(Files.readAllBytes(f.toPath()), StandardCharsets.UTF_8).trim(); if (t.length() >= 16) return t; }
        String id = java.util.UUID.randomUUID().toString().replace("-", "");
        dados.mkdirs();
        Files.write(f.toPath(), id.getBytes(StandardCharsets.UTF_8));
        return id;
    }

    static JSONObject lerConta(File dados) {
        try { JSONObject o = new JSONObject(new String(Files.readAllBytes(new File(dados, "conta.json").toPath()), StandardCharsets.UTF_8)); return o.optString("token").isEmpty() ? null : o; } catch (Exception e) { return null; }
    }

    public static JSONObject entrar(Rede rede, File dados, String email, String senha, String nomeAparelho) throws Exception {
        String disp = idDoAparelho(dados);
        JSONObject corpo = new JSONObject().put("email", email.trim()).put("senha", senha)
                .put("dispositivo", new JSONObject().put("id", disp).put("nome", nomeAparelho).put("plataforma", "android"));
        Resposta r = rede.pedir("POST", "/id/entrar", null, corpo.toString().getBytes(StandardCharsets.UTF_8), null);
        if (r.status != 200) throw new Exception(mensagem(r));
        JSONObject resp = new JSONObject(r.texto());
        String token = resp.optString("token", "");
        if (token.isEmpty()) throw new Exception("O servidor não devolveu o login.");
        JSONObject conta = new JSONObject().put("token", token).put("email", email.trim().toLowerCase(Locale.ROOT)).put("dispositivo", disp).put("selo", resp.optString("selo", ""));
        dados.mkdirs();
        Files.write(new File(dados, "conta.json").toPath(), conta.toString().getBytes(StandardCharsets.UTF_8));
        return new JSONObject().put("logado", true).put("email", conta.getString("email")).put("selo", conta.optString("selo", ""));
    }

    public static void sair(Rede rede, File dados) {
        JSONObject c = lerConta(dados);
        if (c != null) { try { rede.pedir("POST", "/id/sair", c.getString("token"), "{}".getBytes(StandardCharsets.UTF_8), null); } catch (Exception ignora) { } }
        new File(dados, "conta.json").delete();
    }

    public static JSONObject estado(Rede rede, File dados) throws Exception {
        JSONObject c = lerConta(dados);
        if (c == null) return new JSONObject().put("logado", false).put("vortex", false);
        JSONObject fim401 = new JSONObject().put("logado", false).put("vortex", false).put("mensagem", "Sua sessão terminou. Entre de novo.");
        try {
            // recibo de licença assinado: o app confere a assinatura e decide se abre (sem internet também)
            Resposta rv = rede.pedir("GET", "/id/verificar", c.getString("token"), null, null);
            if (rv.status == 200) {
                String novo = new JSONObject(rv.texto()).optJSONObject("licenca") == null ? "" : new JSONObject(rv.texto()).getJSONObject("licenca").optString("selo", "");
                if (!novo.isEmpty() && !novo.equals(c.optString("selo", ""))) {
                    c.put("selo", novo);
                    Files.write(new File(dados, "conta.json").toPath(), c.toString().getBytes(StandardCharsets.UTF_8));
                }
            } else if (rv.status == 401 || rv.status == 403) { new File(dados, "conta.json").delete(); return fim401; }
            Resposta r = rede.pedir("GET", "/vortex/licenca", c.getString("token"), null, null);
            String selo = c.optString("selo", "");
            if (r.status == 200) {
                JSONObject v = new JSONObject(r.texto());
                return new JSONObject().put("logado", true).put("email", c.getString("email")).put("selo", selo).put("vortex", v.optBoolean("vortex", false)).put("mensagem", v.optString("mensagem", ""));
            }
            if (r.status == 401 || r.status == 403) { new File(dados, "conta.json").delete(); return fim401; }
            return new JSONObject().put("logado", true).put("email", c.getString("email")).put("selo", selo).put("vortex", false).put("mensagem", mensagem(r));
        } catch (Exception semRede) {
            // sem internet: quem decide se abre é o selo assinado (vale alguns dias offline)
            return new JSONObject().put("logado", true).put("email", c.getString("email")).put("selo", c.optString("selo", "")).put("vortex", true).put("offline", true);
        }
    }

    /** Ponte de voz: pedidos novos da Vênus (e aviso de que o Vortex está aberto). */
    public static JSONObject fila(Rede rede, File dados) throws Exception {
        JSONObject c = lerConta(dados);
        if (c == null) throw new Exception("Sem conta.");
        Resposta r = rede.pedir("GET", "/vortex/fila?plataforma=android", c.getString("token"), null, null);
        if (r.status != 200) throw new Exception(mensagem(r));
        return new JSONObject(r.texto());
    }

    public static void responder(Rede rede, File dados, String id, boolean ok, String resumo) throws Exception {
        JSONObject c = lerConta(dados);
        if (c == null) throw new Exception("Sem conta.");
        if (!id.matches("[a-f0-9]{24}")) throw new Exception("Pedido inválido.");
        Resposta r = rede.pedir("POST", "/vortex/pedidos/" + id + "/resultado", c.getString("token"), new JSONObject().put("ok", ok).put("resumo", resumo).toString().getBytes(StandardCharsets.UTF_8), null);
        if (r.status != 200) throw new Exception(mensagem(r));
    }

    /** Chamada simples ao servidor com o token deste aparelho (usada pela Steam). */
    public static JSONObject pedirAoServidor(Rede rede, File dados, String metodo, String caminho) throws Exception {
        JSONObject conta = lerConta(dados);
        if (conta == null) throw new Exception("Entre na sua conta Vetorial ID.");
        Resposta r = rede.pedir(metodo, caminho, conta.getString("token"), metodo.equals("POST") ? "{}".getBytes(StandardCharsets.UTF_8) : null, null);
        JSONObject j;
        try { j = new JSONObject(r.texto()); } catch (Exception e) { j = new JSONObject(); }
        if (r.status >= 400) throw new Exception(j.optString("error", "O servidor respondeu " + r.status + "."));
        return j;
    }

    /** Jogos com save na conta (de qualquer aparelho): a resposta do servidor sem mexer em nada. */
    public static JSONObject listaDeSaves(Rede rede, File dados) throws Exception {
        JSONObject conta = lerConta(dados);
        if (conta == null) throw new Exception("Entre na sua conta Vetorial ID.");
        Resposta r = rede.pedir("GET", "/vortex/saves", conta.getString("token"), null, null);
        if (r.status != 200) throw new Exception(mensagem(r));
        return new JSONObject(r.texto());
    }

    /** politica: "perguntar", "local" ou "nuvem". */
    public static JSONObject sincronizar(Rede rede, File dados, List<Item> itens, String politica) throws Exception {
        JSONObject conta = lerConta(dados);
        if (conta == null) throw new Exception("Entre na sua conta Vetorial ID para sincronizar os saves.");
        String token = conta.getString("token");
        Resposta lr = rede.pedir("GET", "/vortex/saves", token, null, null);
        if (lr.status != 200) throw new Exception(mensagem(lr));
        Map<String, Long> nuvem = new HashMap<String, Long>();
        JSONArray saves = new JSONObject(lr.texto()).optJSONArray("saves");
        if (saves != null) for (int i = 0; i < saves.length(); i++) { JSONObject s = saves.getJSONObject(i); nuvem.put(s.getString("jogo") + "/" + s.getString("arquivo"), s.optLong("versao", 0)); }
        File arqEstado = new File(dados, "saves_estado.json");
        JSONObject estado = new JSONObject();
        try { estado = new JSONObject(new String(Files.readAllBytes(arqEstado.toPath()), StandardCharsets.UTF_8)); } catch (Exception ignora) { }
        int enviados = 0, baixados = 0;
        JSONArray conflitos = new JSONArray(), falhas = new JSONArray();
        for (Item it : itens) {
            String chave = it.jogo + "/" + it.arquivo, url = "/vortex/saves/" + it.jogo + "/" + it.arquivo;
            byte[] local = it.caminho.isFile() ? Files.readAllBytes(it.caminho.toPath()) : null;
            if (local != null && local.length == 0) local = null;
            String ls = local == null ? null : sha(local);
            Long remoto = nuvem.get(chave);
            JSONObject marca = estado.optJSONObject(chave);
            String acao; long base = 0;
            if (ls == null && remoto == null) acao = "nada";
            else if (ls != null && remoto == null) acao = "enviar";
            else if (ls == null) acao = "baixar";
            else if (marca == null) acao = "conflito";
            else {
                boolean localMudou = !ls.equals(marca.optString("sha")), remotoMudou = remoto != marca.optLong("versao");
                if (!localMudou && !remotoMudou) acao = "nada";
                else if (localMudou && !remotoMudou) { acao = "enviar"; base = marca.optLong("versao"); }
                else if (!localMudou) acao = "baixar";
                else acao = "conflito";
            }
            if (acao.equals("conflito") && politica.equals("local")) { acao = "enviar"; base = remoto == null ? 0 : remoto; }
            else if (acao.equals("conflito") && politica.equals("nuvem")) acao = "baixar";
            if (acao.equals("conflito")) conflitos.put(chave);
            else if (acao.equals("enviar")) {
                Resposta r = rede.pedir("PUT", url, token, local, base);
                if (r.status == 200) { estado.put(chave, new JSONObject().put("versao", new JSONObject(r.texto()).optLong("versao", base + 1)).put("sha", ls)); enviados++; }
                else if (r.status == 409) conflitos.put(chave);
                else falhas.put(chave + ": " + mensagem(r));
            } else if (acao.equals("baixar")) {
                Resposta r = rede.pedir("GET", url, token, null, null);
                if (r.status == 200) {
                    it.caminho.getParentFile().mkdirs();
                    if (it.caminho.isFile()) Files.copy(it.caminho.toPath(), new File(it.caminho.getPath() + ".antes-da-nuvem").toPath(), StandardCopyOption.REPLACE_EXISTING);
                    File tmp = new File(it.caminho.getPath() + ".vortex-tmp");
                    Files.write(tmp.toPath(), r.corpo);
                    Files.move(tmp.toPath(), it.caminho.toPath(), StandardCopyOption.REPLACE_EXISTING);
                    estado.put(chave, new JSONObject().put("versao", r.versao >= 0 ? r.versao : (remoto == null ? 0 : remoto)).put("sha", sha(r.corpo)));
                    baixados++;
                } else falhas.put(chave + ": " + mensagem(r));
            }
        }
        Files.write(arqEstado.toPath(), estado.toString().getBytes(StandardCharsets.UTF_8));
        return new JSONObject().put("enviados", enviados).put("baixados", baixados).put("conflitos", conflitos).put("falhas", falhas);
    }

    /** Um item por jogo da biblioteca (save de bateria que o JogoActivity guarda em files/saves/<id>.srm). */
    public static List<Item> itensDaBiblioteca(JSONArray jogos, File pastaSaves) throws Exception {
        List<Item> l = new ArrayList<Item>();
        for (int i = 0; i < jogos.length(); i++) {
            JSONObject j = jogos.getJSONObject(i);
            String nome = new File(j.optString("caminho")).getName();
            int p = nome.lastIndexOf('.');
            String stem = p > 0 ? nome.substring(0, p) : nome;
            if (stem.isEmpty() || j.optString("id").isEmpty()) continue;
            l.add(new Item(chaveDoJogo(j.optString("plataforma"), stem), "jogo.srm", new File(pastaSaves, j.getString("id") + ".srm")));
        }
        return l;
    }
}

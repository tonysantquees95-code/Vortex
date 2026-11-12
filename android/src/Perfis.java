package tech.vetorial.vortex;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.io.File;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;

/** Perfis de controle para jogos nativos de Android: onde cada botão do controle toca na tela. Posições em fração da tela (0 a 1). Sem nada do Android aqui, para testar no computador. */
public final class Perfis {
    private Perfis() {}

    /** Teclas do controle que o perfil aceita (nome → código do Android, que não muda). */
    public static final String[] TECLAS = {"A", "B", "X", "Y", "L1", "R1", "L2", "R2", "START", "SELECT", "THUMBL", "THUMBR"};

    public static int codigo(String t) {
        switch (t) {
            case "A": return 96; case "B": return 97; case "X": return 99; case "Y": return 100;
            case "L1": return 102; case "R1": return 103; case "L2": return 104; case "R2": return 105;
            case "START": return 108; case "SELECT": return 109; case "THUMBL": return 106; case "THUMBR": return 107;
            case "UP": return 19; case "DOWN": return 20; case "LEFT": return 21; case "RIGHT": return 22;
            default: return -1;
        }
    }

    public static String nomeDaTecla(int cod) {
        for (String t : TECLAS) if (codigo(t) == cod) return t;
        for (String t : new String[]{"UP", "DOWN", "LEFT", "RIGHT"}) if (codigo(t) == cod) return t;
        return null;
    }

    private static JSONObject toque(String tecla, double x, double y) throws JSONException { return new JSONObject().put("tecla", tecla).put("x", x).put("y", y); }

    /** Modelos prontos: servem de ponto de partida e a pessoa ajusta na tela do jogo. */
    public static JSONArray modelos() throws JSONException {
        JSONArray m = new JSONArray();
        m.put(modelo("acao", "Ação e aventura", "Direcional à esquerda, 4 botões à direita, gatilhos nos cantos.", 0.17, 0.68, 0.11,
                toque("A", 0.90, 0.72), toque("B", 0.82, 0.84), toque("X", 0.77, 0.66), toque("Y", 0.85, 0.52), toque("R1", 0.93, 0.30), toque("L1", 0.07, 0.30), toque("R2", 0.93, 0.18), toque("L2", 0.07, 0.18), toque("START", 0.55, 0.08), toque("SELECT", 0.45, 0.08)));
        m.put(modelo("tiro", "Tiro (FPS e TPS)", "Mover à esquerda; atirar e mirar à direita; pular, agachar e recarregar nos botões.", 0.15, 0.70, 0.11,
                toque("R2", 0.88, 0.62), toque("L2", 0.78, 0.40), toque("A", 0.93, 0.80), toque("B", 0.80, 0.84), toque("X", 0.70, 0.78), toque("Y", 0.93, 0.45), toque("R1", 0.95, 0.28), toque("L1", 0.05, 0.28), toque("START", 0.55, 0.08)));
        m.put(modelo("plataforma", "Plataforma e luta", "Direcional à esquerda; pular, atacar e especial à direita.", 0.14, 0.72, 0.10,
                toque("A", 0.92, 0.76), toque("B", 0.84, 0.86), toque("X", 0.78, 0.68), toque("Y", 0.86, 0.58), toque("R1", 0.92, 0.35), toque("L1", 0.08, 0.35), toque("START", 0.52, 0.08)));
        m.put(modelo("corrida", "Corrida", "Virar nas laterais; acelerar e frear à direita.", 0.10, 0.72, 0.09,
                toque("R2", 0.90, 0.72), toque("L2", 0.80, 0.84), toque("A", 0.88, 0.50), toque("B", 0.78, 0.60), toque("X", 0.66, 0.84), toque("START", 0.52, 0.08)));
        return m;
    }

    private static JSONObject modelo(String id, String nome, String desc, double cx, double cy, double raio, JSONObject... botoes) throws JSONException {
        JSONArray b = new JSONArray();
        for (JSONObject x : botoes) b.put(x);
        return new JSONObject().put("modelo", id).put("nome", nome).put("descricao", desc)
                .put("direcional", new JSONObject().put("cx", cx).put("cy", cy).put("raio", raio)).put("botoes", b);
    }

    public static JSONObject doModelo(String modeloId) throws JSONException {
        JSONArray ms = modelos();
        for (int i = 0; i < ms.length(); i++) if (ms.getJSONObject(i).getString("modelo").equals(modeloId)) return ms.getJSONObject(i);
        return ms.getJSONObject(0);
    }

    /** Perfil novo para um jogo, a partir de um modelo. */
    public static JSONObject novo(String pacote, String nome, String modeloId, long agora) throws JSONException {
        JSONObject m = doModelo(modeloId);
        return new JSONObject().put("id", "p" + Long.toString(agora, 36) + Integer.toString(Math.abs(pacote.hashCode()), 36)).put("pacote", pacote)
                .put("nome", nome == null || nome.trim().isEmpty() ? m.getString("nome") : nome.trim()).put("modelo", modeloId)
                .put("direcional", new JSONObject(m.getJSONObject("direcional").toString())).put("botoes", new JSONArray(m.getJSONArray("botoes").toString()));
    }

    /** Valida e limpa um perfil vindo da tela: só teclas conhecidas, posições dentro da tela. */
    public static JSONObject limpar(JSONObject p) throws JSONException {
        JSONObject r = new JSONObject();
        String id = p.optString("id", "");
        String pacote = p.optString("pacote", "");
        if (id.isEmpty() || !pacote.matches("[A-Za-z0-9_.]+")) throw new JSONException("Perfil inválido.");
        r.put("id", id).put("pacote", pacote).put("nome", p.optString("nome", "Perfil").trim().isEmpty() ? "Perfil" : p.optString("nome", "Perfil").trim()).put("modelo", p.optString("modelo", "acao"));
        JSONObject d = p.optJSONObject("direcional");
        if (d == null) d = new JSONObject().put("cx", 0.17).put("cy", 0.68).put("raio", 0.11);
        r.put("direcional", new JSONObject().put("cx", fr(d.optDouble("cx", 0.17))).put("cy", fr(d.optDouble("cy", 0.68))).put("raio", Math.max(0.03, Math.min(0.3, d.optDouble("raio", 0.11)))));
        JSONArray bs = new JSONArray();
        JSONArray in = p.optJSONArray("botoes");
        java.util.HashSet<String> vistos = new java.util.HashSet<String>();
        if (in != null) for (int i = 0; i < in.length(); i++) {
            JSONObject b = in.getJSONObject(i);
            String t = b.optString("tecla", "");
            if (codigo(t) < 0 || !java.util.Arrays.asList(TECLAS).contains(t) || !vistos.add(t)) continue;
            bs.put(toque(t, fr(b.optDouble("x", 0.5)), fr(b.optDouble("y", 0.5))));
        }
        r.put("botoes", bs);
        return r;
    }

    private static double fr(double v) { return Double.isNaN(v) ? 0.5 : Math.max(0, Math.min(1, v)); }

    /** Para onde tocar quando a tecla do controle é apertada: {x, y} em fração, ou null se a tecla não faz nada neste perfil. */
    public static double[] alvoDaTecla(JSONObject perfil, int keyCode) {
        String nome = nomeDaTecla(keyCode);
        if (nome == null) return null;
        try {
            JSONObject d = perfil.getJSONObject("direcional");
            double cx = d.getDouble("cx"), cy = d.getDouble("cy"), r = d.getDouble("raio");
            switch (nome) {
                case "UP": return new double[]{cx, cy - r};
                case "DOWN": return new double[]{cx, cy + r};
                case "LEFT": return new double[]{cx - r, cy};
                case "RIGHT": return new double[]{cx + r, cy};
                default: break;
            }
            JSONArray bs = perfil.getJSONArray("botoes");
            for (int i = 0; i < bs.length(); i++) if (bs.getJSONObject(i).getString("tecla").equals(nome)) return new double[]{bs.getJSONObject(i).getDouble("x"), bs.getJSONObject(i).getDouble("y")};
        } catch (JSONException ignora) { }
        return null;
    }

    // ------------------------------------------------------------ arquivo: {perfis:[...], ativos:{pacote: id}}
    public static JSONObject carregar(File f) {
        try {
            JSONObject o = new JSONObject(new String(Files.readAllBytes(f.toPath()), StandardCharsets.UTF_8));
            if (!o.has("perfis")) o.put("perfis", new JSONArray());
            if (!o.has("ativos")) o.put("ativos", new JSONObject());
            return o;
        } catch (Exception e) {
            try { return new JSONObject().put("perfis", new JSONArray()).put("ativos", new JSONObject()); } catch (JSONException x) { throw new RuntimeException(x); }
        }
    }

    public static void salvar(File f, JSONObject o) throws Exception {
        if (f.getParentFile() != null) f.getParentFile().mkdirs();
        Files.write(f.toPath(), o.toString().getBytes(StandardCharsets.UTF_8));
    }

    public static JSONObject guardarPerfil(File f, JSONObject perfil) throws Exception {
        JSONObject limpo = limpar(perfil);
        JSONObject o = carregar(f);
        JSONArray l = o.getJSONArray("perfis"), nova = new JSONArray();
        boolean achou = false;
        for (int i = 0; i < l.length(); i++) {
            if (l.getJSONObject(i).getString("id").equals(limpo.getString("id"))) { nova.put(limpo); achou = true; } else nova.put(l.getJSONObject(i));
        }
        if (!achou) nova.put(limpo);
        o.put("perfis", nova);
        if (!o.getJSONObject("ativos").has(limpo.getString("pacote"))) o.getJSONObject("ativos").put(limpo.getString("pacote"), limpo.getString("id"));
        salvar(f, o);
        return limpo;
    }

    public static void apagarPerfil(File f, String id) throws Exception {
        JSONObject o = carregar(f);
        JSONArray l = o.getJSONArray("perfis"), nova = new JSONArray();
        String pacote = null;
        for (int i = 0; i < l.length(); i++) { if (l.getJSONObject(i).getString("id").equals(id)) pacote = l.getJSONObject(i).getString("pacote"); else nova.put(l.getJSONObject(i)); }
        o.put("perfis", nova);
        if (pacote != null && id.equals(o.getJSONObject("ativos").optString(pacote))) {
            o.getJSONObject("ativos").remove(pacote);
            for (int i = 0; i < nova.length(); i++) if (nova.getJSONObject(i).getString("pacote").equals(pacote)) { o.getJSONObject("ativos").put(pacote, nova.getJSONObject(i).getString("id")); break; }
        }
        salvar(f, o);
    }

    public static void ativar(File f, String pacote, String id) throws Exception {
        JSONObject o = carregar(f);
        o.getJSONObject("ativos").put(pacote, id);
        salvar(f, o);
    }

    /** Perfil em uso de um jogo (ou null). */
    public static JSONObject ativoDe(JSONObject todos, String pacote) {
        try {
            String id = todos.getJSONObject("ativos").optString(pacote, "");
            JSONArray l = todos.getJSONArray("perfis");
            for (int i = 0; i < l.length(); i++) if (l.getJSONObject(i).getString("id").equals(id)) return l.getJSONObject(i);
        } catch (JSONException ignora) { }
        return null;
    }
}

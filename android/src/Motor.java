package tech.vetorial.vortex;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.security.MessageDigest;
import java.text.Normalizer;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/** Motor do Vortex no Android: mesma interface JSON do motor em Rust (biblioteca, escaneamento, favoritos, tempo de jogo). Sem nada do Android aqui, para testar no computador. */
public class Motor {
    public interface Relogio { long agora(); }

    private final Relogio relogio;

    public Motor(Relogio relogio) { this.relogio = relogio; }

    public Object executar(String comando, JSONObject args) throws Exception {
        File arquivo = new File(args.optString("biblioteca", ""));
        if (args.optString("biblioteca", "").isEmpty()) throw new Exception("Faltou informar: biblioteca.");
        JSONObject bib = carregar(arquivo);
        long t = args.has("agora") ? args.getLong("agora") : relogio.agora();
        JSONObject jogos = bib.getJSONObject("jogos");
        switch (comando) {
            case "pastas": return bib.getJSONArray("pastas");
            case "adicionar_pasta": {
                String p = texto(args, "pasta");
                if (!new File(p).isDirectory()) throw new Exception("Essa pasta não existe.");
                if (!contem(bib.getJSONArray("pastas"), p)) bib.getJSONArray("pastas").put(p);
                salvar(arquivo, bib);
                return bib.getJSONArray("pastas");
            }
            case "remover_pasta": {
                String p = texto(args, "pasta");
                JSONArray nova = new JSONArray();
                JSONArray velha = bib.getJSONArray("pastas");
                for (int i = 0; i < velha.length(); i++) if (!velha.getString(i).equals(p)) nova.put(velha.getString(i));
                bib.put("pastas", nova);
                int removidos = 0;
                for (String id : chaves(jogos)) {
                    if (jogos.getJSONObject(id).optString("raiz").equals(p)) { jogos.remove(id); removidos++; }
                }
                salvar(arquivo, bib);
                return new JSONObject().put("jogos_removidos", removidos);
            }
            case "escanear": {
                JSONObject r = escanear(bib, t);
                salvar(arquivo, bib);
                return r;
            }
            case "listar": return listar(jogos, args.optJSONObject("filtro"));
            case "continuar": {
                JSONObject f = new JSONObject().put("ordem", "recentes");
                List<JSONObject> l = lista(listar(jogos, f));
                JSONArray r = new JSONArray();
                int lim = args.optInt("limite", 10);
                for (JSONObject j : l) if (j.optLong("ultimo_jogo") > 0 && r.length() < lim) r.put(j);
                return r;
            }
            case "plataformas": return resumoPlataformas(jogos);
            case "estatisticas": {
                long tempo = 0; int fav = 0, sessoes = 0;
                Map<String, Boolean> plats = new HashMap<String, Boolean>();
                for (String id : chaves(jogos)) {
                    JSONObject j = jogos.getJSONObject(id);
                    tempo += j.optLong("tempo_total_s"); sessoes += j.optInt("sessoes");
                    if (j.optBoolean("favorito")) fav++;
                    plats.put(j.optString("plataforma"), true);
                }
                return new JSONObject().put("jogos", jogos.length()).put("plataformas", plats.size()).put("favoritos", fav).put("tempo_total_s", tempo).put("sessoes", sessoes);
            }
            case "jogo": {
                JSONObject j = jogos.optJSONObject(texto(args, "id"));
                if (j == null) throw new Exception("Esse jogo não está mais na biblioteca.");
                return j;
            }
            case "favoritar": {
                JSONObject j = jogos.optJSONObject(texto(args, "id"));
                if (j == null) throw new Exception("Esse jogo não está mais na biblioteca.");
                j.put("favorito", args.optBoolean("favorito", true));
                salvar(arquivo, bib);
                return new JSONObject().put("ok", true);
            }
            case "sessao_iniciar": {
                JSONObject j = jogos.optJSONObject(texto(args, "id"));
                if (j == null) throw new Exception("Esse jogo não está mais na biblioteca.");
                bib.getJSONObject("em_andamento").put(j.getString("id"), t);
                salvar(arquivo, bib);
                return new JSONObject().put("ok", true).put("inicio", t);
            }
            case "sessao_encerrar": {
                String id = texto(args, "id");
                JSONObject em = bib.getJSONObject("em_andamento");
                if (!em.has(id)) return new JSONObject().put("duracao_s", 0);
                long inicio = em.getLong(id);
                em.remove(id);
                long d = Math.max(0, t - inicio);
                JSONObject j = jogos.optJSONObject(id);
                if (j != null && d >= 1) {
                    j.put("tempo_total_s", j.optLong("tempo_total_s") + d).put("sessoes", j.optInt("sessoes") + 1).put("ultimo_jogo", t);
                    bib.getJSONArray("historico").put(new JSONObject().put("jogo", id).put("inicio", inicio).put("fim", t).put("duracao_s", d));
                }
                salvar(arquivo, bib);
                return new JSONObject().put("duracao_s", d);
            }
            case "historico": {
                JSONArray h = bib.getJSONArray("historico"), r = new JSONArray();
                int lim = args.optInt("limite", 50);
                for (int i = h.length() - 1; i >= 0 && r.length() < lim; i--) r.put(h.get(i));
                return r;
            }
            case "modo_jogo_config": {
                File f = new File(arquivo.getParentFile(), "modo_jogo_config.json");
                JSONObject c = f.exists() ? new JSONObject(new String(Files.readAllBytes(f.toPath()), StandardCharsets.UTF_8)) : padraoModoJogo();
                if (args.has("configuracao")) {
                    c = args.getJSONObject("configuracao");
                    gravar(f, c.toString());
                }
                return c;
            }
            case "organizar_candidatos": {
                JSONArray r = new JSONArray();
                for (File f : Organizador.candidatos(raizesDoArmazenamento(args))) r.put(f.getPath());
                return r;
            }
            case "organizar": {
                boolean sim = args.optBoolean("simulacao", false);
                File vortex = new File(args.optString("pasta_vortex", "/storage/emulated/0/Vortex/Jogos"));
                List<File> origens = new ArrayList<File>();
                if (args.has("origens")) { JSONArray o = args.getJSONArray("origens"); for (int i = 0; i < o.length(); i++) origens.add(new File(o.getString(i))); }
                else origens = Organizador.candidatos(raizesDoArmazenamento(args));
                Organizador.Resultado res = Organizador.organizar(origens, vortex, sim);
                JSONArray org = new JSONArray();
                for (Organizador.Item it : res.organizados) org.put(it.json());
                if (!sim) {
                    File reg = new File(arquivo.getParentFile(), "organizador.json");
                    JSONArray todos = reg.exists() ? new JSONObject(new String(Files.readAllBytes(reg.toPath()), StandardCharsets.UTF_8)).optJSONArray("movimentos") : null;
                    if (todos == null) todos = new JSONArray();
                    for (Organizador.Item it : res.registro) todos.put(it.json());
                    gravar(reg, new JSONObject().put("movimentos", todos).toString());
                    vortex.mkdirs();
                    if (!contem(bib.getJSONArray("pastas"), vortex.getPath())) bib.getJSONArray("pastas").put(vortex.getPath());
                    escanear(bib, t);
                    salvar(arquivo, bib);
                }
                return new JSONObject().put("organizados", org).put("ja_no_lugar", 0).put("falhas", new JSONArray(res.falhas)).put("simulacao", sim).put("pasta_vortex", vortex.getPath()).put("origens", new JSONArray(pathsDe(origens)));
            }
            case "organizar_desfazer": {
                File reg = new File(arquivo.getParentFile(), "organizador.json");
                JSONArray mov = reg.exists() ? new JSONObject(new String(Files.readAllBytes(reg.toPath()), StandardCharsets.UTF_8)).optJSONArray("movimentos") : new JSONArray();
                JSONObject r = Organizador.desfazer(mov == null ? new JSONArray() : mov);
                reg.delete();
                escanear(bib, t);
                salvar(arquivo, bib);
                return r;
            }
            case "modo_jogo_recuperar": return new JSONObject().put("desfeito", false);
            default: throw new Exception("Comando desconhecido: " + comando);
        }
    }

    private static List<String> pathsDe(List<File> l) { List<String> r = new ArrayList<String>(); for (File f : l) r.add(f.getPath()); return r; }

    /** Raízes onde procurar: o armazenamento interno e os cartões (/storage/XXXX-XXXX). Nos testes, `raizes` vem nos argumentos. */
    private static List<String> raizesDoArmazenamento(JSONObject args) {
        List<String> r = new ArrayList<String>();
        JSONArray dados = args.optJSONArray("raizes");
        if (dados != null) { for (int i = 0; i < dados.length(); i++) r.add(dados.optString(i)); return r; }
        r.add("/storage/emulated/0");
        File[] vs = new File("/storage").listFiles();
        if (vs != null) for (File v : vs) if (v.isDirectory() && !v.getName().equals("emulated") && !v.getName().equals("self")) r.add(v.getPath());
        return r;
    }

    static JSONObject padraoModoJogo() throws JSONException {
        return new JSONObject().put("ligado", true).put("prioridade_do_jogo", true).put("rebaixar_apps", true).put("pausar_atualizadores", true).put("liberar_ram", true)
                .put("bloquear_notificacoes", true).put("energia_maxima", true).put("gpu_dedicada", true).put("manter_acordado", true)
                .put("protegidos_extra", new JSONArray()).put("rebaixar_extra", new JSONArray());
    }

    /** "primary:Roms/SNES" → /storage/emulated/0/Roms/SNES; "1A2B-3C4D:Jogos" → /storage/1A2B-3C4D/Jogos. */
    public static String caminhoDaArvore(String id) {
        int d = id.indexOf(':');
        if (d < 0) return null;
        String volume = id.substring(0, d), resto = id.substring(d + 1);
        String base = volume.equals("primary") ? "/storage/emulated/0" : "/storage/" + volume;
        return resto.isEmpty() ? base : base + "/" + resto;
    }

    // ------------------------------------------------------------ escaneamento
    private JSONObject escanear(JSONObject bib, long t) throws Exception {
        JSONObject jogos = bib.getJSONObject("jogos");
        JSONArray pastas = bib.getJSONArray("pastas");
        Map<String, Boolean> vistos = new HashMap<String, Boolean>();
        int encontrados = 0, novos = 0, atualizados = 0, removidos = 0;
        JSONArray ausentes = new JSONArray();
        for (int i = 0; i < pastas.length(); i++) {
            File raiz = new File(pastas.getString(i));
            if (!raiz.isDirectory()) { ausentes.put(raiz.getPath()); continue; }
            List<File> arquivos = new ArrayList<File>();
            percorrer(raiz, arquivos, 0);
            for (File f : arquivos) {
                Plataformas.P p = identificar(f, raiz);
                if (p == null) continue;
                encontrados++;
                String id = idDe(f.getAbsolutePath());
                vistos.put(id, true);
                JSONObject j = jogos.optJSONObject(id);
                if (j == null) {
                    j = new JSONObject().put("id", id).put("favorito", false).put("ultimo_jogo", 0).put("tempo_total_s", 0).put("sessoes", 0).put("adicionado", t)
                            .put("regioes", new JSONArray()).put("idiomas", new JSONArray()).put("tags", new JSONArray()).put("capa", JSONObject.NULL).put("capa_online", JSONObject.NULL)
                            .put("descricao", JSONObject.NULL).put("desenvolvedor", JSONObject.NULL).put("editora", JSONObject.NULL).put("ano", JSONObject.NULL)
                            .put("genero", JSONObject.NULL).put("jogadores", JSONObject.NULL);
                    jogos.put(id, j);
                    novos++;
                } else atualizados++;
                j.put("titulo", titulo(f.getName())).put("plataforma", p.id).put("caminho", f.getAbsolutePath()).put("raiz", raiz.getPath()).put("bytes", f.length()).put("disponivel", true);
            }
        }
        for (String id : chaves(jogos)) {
            if (vistos.containsKey(id)) continue;
            JSONObject j = jogos.getJSONObject(id);
            // jogos de pastas ausentes (HD/cartão desconectado) ficam na biblioteca, marcados como indisponíveis
            boolean pastaAusente = false;
            for (int k = 0; k < ausentes.length(); k++) if (ausentes.getString(k).equals(j.optString("raiz"))) pastaAusente = true;
            if (pastaAusente) { j.put("disponivel", false); continue; }
            if (!contem(pastas, j.optString("raiz"))) continue;
            jogos.remove(id);
            removidos++;
        }
        return new JSONObject().put("encontrados", encontrados).put("novos", novos).put("atualizados", atualizados).put("removidos", removidos).put("ignorados", 0).put("pastas_ausentes", ausentes);
    }

    private void percorrer(File dir, List<File> saida, int nivel) {
        if (nivel > 8) return;
        File[] fs = dir.listFiles();
        if (fs == null) return;
        for (File f : fs) {
            if (f.getName().startsWith(".")) continue;
            if (f.isDirectory()) percorrer(f, saida, nivel + 1); else saida.add(f);
        }
    }

    static String normalizar(String s) {
        String n = Normalizer.normalize(s, Normalizer.Form.NFD).replaceAll("\\p{M}", "").toLowerCase(Locale.ROOT);
        return n.replaceAll("[^a-z0-9]", "");
    }

    public static Plataformas.P unicaPelaExtensao(String ext) {
        if (ext.equals("zip") || ext.equals("7z")) return null;
        Plataformas.P achada = null;
        int n = 0;
        for (Plataformas.P p : Plataformas.TODAS) for (String e : p.extensoes) if (e.equals(ext)) { achada = p; n++; }
        return n == 1 && !achada.exigePasta ? achada : null;
    }

    public static Plataformas.P plataformaDaPasta(File arquivo, File raiz) {
        File pasta = arquivo.getParentFile();
        String base = raiz.getAbsolutePath();
        while (pasta != null && pasta.getAbsolutePath().startsWith(base)) {
            String n = normalizar(pasta.getName());
            for (Plataformas.P p : Plataformas.TODAS) { if (p.id.equals(n)) return p; for (String f : p.pastas) if (f.equals(n)) return p; }
            if (pasta.getAbsolutePath().equals(base)) break;
            pasta = pasta.getParentFile();
        }
        return null;
    }

    /** Pela pasta (mais perto do arquivo primeiro) ou, se ninguém reclama a extensão, pela extensão. */
    public static Plataformas.P identificar(File arquivo, File raiz) {
        String nome = arquivo.getName();
        int ponto = nome.lastIndexOf('.');
        if (ponto < 0) return null;
        String ext = nome.substring(ponto + 1).toLowerCase(Locale.ROOT);
        List<Plataformas.P> aceitam = new ArrayList<Plataformas.P>();
        for (Plataformas.P p : Plataformas.TODAS) for (String e : p.extensoes) if (e.equals(ext)) aceitam.add(p);
        if (aceitam.isEmpty()) return null;
        File pasta = arquivo.getParentFile();
        String base = raiz.getAbsolutePath();
        while (pasta != null && pasta.getAbsolutePath().startsWith(base)) {
            String n = normalizar(pasta.getName());
            for (Plataformas.P p : aceitam) for (String f : p.pastas) if (f.equals(n)) return p;
            if (pasta.getAbsolutePath().equals(base)) break;
            pasta = pasta.getParentFile();
        }
        if (aceitam.size() == 1 && !aceitam.get(0).exigePasta) return aceitam.get(0);
        return null;
    }

    static String titulo(String arquivo) {
        int ponto = arquivo.lastIndexOf('.');
        String s = ponto > 0 ? arquivo.substring(0, ponto) : arquivo;
        s = s.replaceAll("\\([^)]*\\)|\\[[^\\]]*\\]", " ").replace('_', ' ').replaceAll("\\s+", " ").trim();
        // "Legend of Zelda, The" -> "The Legend of Zelda"
        java.util.regex.Matcher m = java.util.regex.Pattern.compile("^(.*), (The|A|An|O|Os|As)( - .*)?$").matcher(s);
        if (m.matches()) s = m.group(2) + " " + m.group(1) + (m.group(3) == null ? "" : m.group(3));
        return s.isEmpty() ? arquivo : s;
    }

    // ------------------------------------------------------------ consultas
    private JSONArray listar(JSONObject jogos, JSONObject filtro) throws JSONException {
        if (filtro == null) filtro = new JSONObject();
        final String ordem = filtro.optString("ordem", "titulo");
        String texto = filtro.optString("texto", "").toLowerCase(Locale.ROOT);
        String plat = filtro.isNull("plataforma") ? "" : filtro.optString("plataforma", "");
        boolean soFav = filtro.optBoolean("so_favoritos", false);
        List<JSONObject> l = new ArrayList<JSONObject>();
        for (String id : chaves(jogos)) {
            JSONObject j = jogos.getJSONObject(id);
            if (!plat.isEmpty() && !j.optString("plataforma").equals(plat)) continue;
            if (soFav && !j.optBoolean("favorito")) continue;
            if (!texto.isEmpty() && !j.optString("titulo").toLowerCase(Locale.ROOT).contains(texto)) continue;
            l.add(j);
        }
        Collections.sort(l, new Comparator<JSONObject>() {
            public int compare(JSONObject a, JSONObject b) {
                switch (ordem) {
                    case "recentes": return Long.compare(b.optLong("ultimo_jogo"), a.optLong("ultimo_jogo"));
                    case "mais_jogados": return Long.compare(b.optLong("tempo_total_s"), a.optLong("tempo_total_s"));
                    case "adicionados": return Long.compare(b.optLong("adicionado"), a.optLong("adicionado"));
                    case "ano": return Integer.compare(b.optInt("ano"), a.optInt("ano"));
                    default: return a.optString("titulo").compareToIgnoreCase(b.optString("titulo"));
                }
            }
        });
        int lim = filtro.optInt("limite", 0);
        JSONArray r = new JSONArray();
        for (JSONObject j : l) { if (lim > 0 && r.length() >= lim) break; r.put(j); }
        return r;
    }

    private JSONArray resumoPlataformas(JSONObject jogos) throws JSONException {
        Map<String, Integer> n = new HashMap<String, Integer>();
        for (String id : chaves(jogos)) { String p = jogos.getJSONObject(id).optString("plataforma"); Integer c = n.get(p); n.put(p, c == null ? 1 : c + 1); }
        JSONArray r = new JSONArray();
        for (Plataformas.P p : Plataformas.TODAS) {
            Integer c = n.get(p.id);
            if (c != null) r.put(new JSONObject().put("id", p.id).put("nome", p.nome).put("tipo", p.tipo).put("total", c));
        }
        return r;
    }

    private static List<JSONObject> lista(JSONArray a) throws JSONException {
        List<JSONObject> l = new ArrayList<JSONObject>();
        for (int i = 0; i < a.length(); i++) l.add(a.getJSONObject(i));
        return l;
    }

    // ------------------------------------------------------------ arquivo
    private static String texto(JSONObject a, String campo) throws Exception {
        String s = a.optString(campo, "").trim();
        if (s.isEmpty()) throw new Exception("Faltou informar: " + campo + ".");
        return s;
    }

    private static boolean contem(JSONArray a, String s) {
        for (int i = 0; i < a.length(); i++) if (a.optString(i).equals(s)) return true;
        return false;
    }

    private static List<String> chaves(JSONObject o) {
        List<String> l = new ArrayList<String>();
        java.util.Iterator<String> it = o.keys();
        while (it.hasNext()) l.add(it.next());
        return l;
    }

    static String idDe(String caminho) throws Exception {
        byte[] h = MessageDigest.getInstance("SHA-1").digest(caminho.getBytes(StandardCharsets.UTF_8));
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < 8; i++) sb.append(String.format("%02x", h[i]));
        return sb.toString();
    }

    private static JSONObject carregar(File f) {
        try {
            JSONObject b = new JSONObject(new String(Files.readAllBytes(f.toPath()), StandardCharsets.UTF_8));
            if (!b.has("pastas")) b.put("pastas", new JSONArray());
            if (!b.has("jogos")) b.put("jogos", new JSONObject());
            if (!b.has("historico")) b.put("historico", new JSONArray());
            if (!b.has("em_andamento")) b.put("em_andamento", new JSONObject());
            return b;
        } catch (Exception e) {
            try { return new JSONObject().put("versao", 1).put("pastas", new JSONArray()).put("jogos", new JSONObject()).put("historico", new JSONArray()).put("em_andamento", new JSONObject()); }
            catch (JSONException x) { throw new RuntimeException(x); }
        }
    }

    private static void salvar(File f, JSONObject b) throws IOException { gravar(f, b.toString()); }

    private static void gravar(File f, String texto) throws IOException {
        File pai = f.getParentFile();
        if (pai != null) pai.mkdirs();
        File tmp = new File(f.getPath() + ".tmp");
        FileOutputStream o = new FileOutputStream(tmp);
        try { o.write(texto.getBytes(StandardCharsets.UTF_8)); } finally { o.close(); }
        if (!tmp.renameTo(f)) { Files.copy(tmp.toPath(), f.toPath(), java.nio.file.StandardCopyOption.REPLACE_EXISTING); tmp.delete(); }
    }
}

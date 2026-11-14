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
    private final Baixador baixador;

    public interface Baixador { void baixar(String url, File destino) throws Exception; }

    public Motor(Relogio relogio) { this(relogio, null); }

    public Motor(Relogio relogio, Baixador baixador) { this.relogio = relogio; this.baixador = baixador != null ? baixador : new Baixador() { public void baixar(String u, File d) throws Exception { baixarHttps(u, d); } }; }

    static boolean hospedeiroPermitido(String url) { return url.startsWith("https://raw.githubusercontent.com/"); }

    /** Download de verdade (HTTPS), só dos servidores do catálogo. */
    static void baixarHttps(String url, File destino) throws Exception {
        if (!hospedeiroPermitido(url)) throw new Exception("Endereço de download não permitido.");
        java.net.HttpURLConnection h = (java.net.HttpURLConnection) new java.net.URL(url).openConnection();
        h.setConnectTimeout(20000);
        h.setReadTimeout(60000);
        if (h.getResponseCode() != 200) throw new Exception("O servidor do jogo respondeu com erro " + h.getResponseCode() + ". Tente de novo mais tarde.");
        try (java.io.InputStream in = h.getInputStream(); FileOutputStream o = new FileOutputStream(destino)) {
            byte[] buf = new byte[65536]; int n;
            while ((n = in.read(buf)) > 0) o.write(buf, 0, n);
        } finally { h.disconnect(); }
    }

    static String sha256(File f) throws Exception {
        MessageDigest md = MessageDigest.getInstance("SHA-256");
        try (java.io.InputStream in = new java.io.FileInputStream(f)) { byte[] buf = new byte[65536]; int n; while ((n = in.read(buf)) > 0) md.update(buf, 0, n); }
        StringBuilder sb = new StringBuilder();
        for (byte x : md.digest()) sb.append(String.format("%02x", x));
        return sb.toString();
    }

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
            case "limpar": {
                JSONObject r = Limpeza.limpar(jogos, args.optBoolean("simulacao", false));
                if (!r.optBoolean("simulacao")) salvar(arquivo, bib);
                return r;
            }
            case "isolar": {
                JSONObject r = Limpeza.isolar(jogos, texto(args, "id"));
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
                JSONObject faxina = null;
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
                    faxina = Limpeza.limpar(jogos, false);
                    salvar(arquivo, bib);
                }
                JSONArray falhasTodas = new JSONArray(res.falhas);
                if (faxina != null) { JSONArray ff = faxina.optJSONArray("falhas"); for (int i = 0; ff != null && i < ff.length(); i++) falhasTodas.put(ff.getString(i)); }
                return new JSONObject().put("descartados", new JSONArray(res.descartados)).put("duplicados", faxina == null ? new JSONArray() : faxina.getJSONArray("duplicados")).put("corrompidos", faxina == null ? new JSONArray() : faxina.getJSONArray("corrompidos")).put("organizados", org).put("ja_no_lugar", 0).put("falhas", falhasTodas).put("simulacao", sim).put("pasta_vortex", vortex.getPath()).put("origens", new JSONArray(pathsDe(origens)));
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
            case "loja_catalogo": return lojaCatalogo(args, arquivo, jogos);
            case "loja_instalar": {
                JSONObject oferta = null;
                JSONArray cat = new JSONObject(args.optString("catalogo_json", "{\"jogos\":[]}")).getJSONArray("jogos");
                for (int i = 0; i < cat.length(); i++) if (cat.getJSONObject(i).getString("id").equals(texto(args, "id"))) oferta = cat.getJSONObject(i);
                if (oferta == null) throw new Exception("Esse jogo não está mais no catálogo.");
                File vortex = new File(args.optString("pasta_vortex", "/storage/emulated/0/Vortex/Jogos"));
                File tmp = new File(arquivo.getParentFile(), "loja/" + oferta.getString("id"));
                deletarArvore(tmp);
                tmp.mkdirs();
                String destino;
                try {
                    File zip = new File(tmp, oferta.getString("id") + ".zip");
                    baixador.baixar(oferta.getString("url"), zip);
                    if (!sha256(zip).equalsIgnoreCase(oferta.getString("sha256"))) throw new Exception("O arquivo baixado não confere com o catálogo (pode estar corrompido). Tente de novo mais tarde.");
                    Organizador.Resultado res = Organizador.organizar(java.util.Collections.singletonList(tmp), vortex, false);
                    if (!res.falhas.isEmpty()) throw new Exception(res.falhas.get(0));
                    if (res.organizados.isEmpty()) throw new Exception("Não consegui identificar o jogo dentro do arquivo baixado.");
                    destino = res.organizados.get(0).destino.getPath();
                } finally { deletarArvore(tmp); }
                File marc = new File(arquivo.getParentFile(), "loja_instalados.json");
                JSONObject m = marc.exists() ? new JSONObject(new String(Files.readAllBytes(marc.toPath()), StandardCharsets.UTF_8)) : new JSONObject();
                m.put(oferta.getString("id"), destino);
                gravar(marc, m.toString());
                if (!contem(bib.getJSONArray("pastas"), vortex.getPath())) bib.getJSONArray("pastas").put(vortex.getPath());
                escanear(bib, t);
                salvar(arquivo, bib);
                for (int i = 0; i < 0; i++) { }
                JSONArray novo = lojaCatalogo(args, arquivo, bib.getJSONObject("jogos"));
                Object jogoId = JSONObject.NULL;
                for (int i = 0; i < novo.length(); i++) if (novo.getJSONObject(i).getString("id").equals(oferta.getString("id"))) jogoId = novo.getJSONObject(i).get("jogo_id");
                return new JSONObject().put("instalado", true).put("jogo_id", jogoId);
            }
            case "modo_jogo_recuperar": return new JSONObject().put("desfeito", false);
            default: throw new Exception("Comando desconhecido: " + comando);
        }
    }

    private static void deletarArvore(File f) {
        File[] fs = f.listFiles();
        if (fs != null) for (File x : fs) deletarArvore(x);
        f.delete();
    }

    /** Catálogo da loja com o que já está instalado e o id do jogo na biblioteca (para o botão Jogar). */
    private JSONArray lojaCatalogo(JSONObject args, File arquivo, JSONObject jogos) throws Exception {
        JSONArray cat = new JSONObject(args.optString("catalogo_json", "{\"jogos\":[]}")).getJSONArray("jogos");
        File marc = new File(arquivo.getParentFile(), "loja_instalados.json");
        JSONObject m = marc.exists() ? new JSONObject(new String(Files.readAllBytes(marc.toPath()), StandardCharsets.UTF_8)) : new JSONObject();
        JSONArray r = new JSONArray();
        for (int i = 0; i < cat.length(); i++) {
            JSONObject o = cat.getJSONObject(i);
            String caminho = m.optString(o.getString("id"), "");
            boolean inst = !caminho.isEmpty() && new File(caminho).isFile();
            Object jogoId = JSONObject.NULL;
            if (inst) for (String id : chaves(jogos)) if (jogos.getJSONObject(id).optString("caminho").equals(caminho)) jogoId = id;
            o.put("instalado", inst).put("jogo_id", jogoId);
            r.put(o);
        }
        return r;
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
                // "00", "0C"…: pedaços de arquivo dividido, não jogos
                String nomeF = f.getName();
                int pt = nomeF.lastIndexOf('.');
                if ((pt > 0 ? pt : nomeF.length()) <= 2) continue;
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
                // GameCube/Wii: o próprio disco diz o código e o nome do jogo (e a região): ajuda a achar a capa
                if ((p.id.equals("gamecube") || p.id.equals("wii")) && !j.has("nome_interno")) {
                    String[] h = cabecalhoNintendo(f);
                    if (h != null) {
                        j.put("id_jogo", h[0]).put("nome_interno", h[1]);
                        String reg = regiaoDoCodigo(h[0]);
                        JSONArray rs = j.optJSONArray("regioes");
                        if (reg != null && (rs == null || rs.length() == 0)) j.put("regioes", new JSONArray().put(reg));
                    }
                }
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

    private static final java.util.Set<String> PASTAS_IGNORADAS = new java.util.HashSet<String>(java.util.Arrays.asList("bios", "media", "images", "image", "covers", "cover", "boxart", "boxarts", "namedboxarts", "downloadedmedia", "downloadedimages", "manuals", "manual", "saves", "states", "savestates", "screenshots", "snaps", "thumbnails", "cheats", "system", "videos", "marquees", "fanart", "wheel", "backups", "duplicados", "corrompidos"));

    private void percorrer(File dir, List<File> saida, int nivel) {
        if (nivel > 8) return;
        File[] fs = dir.listFiles();
        if (fs == null) return;
        for (File f : fs) {
            if (f.getName().startsWith(".")) continue;
            if (f.isDirectory()) { if (!PASTAS_IGNORADAS.contains(normalizar(f.getName()))) percorrer(f, saida, nivel + 1); } else saida.add(f);
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

    /** Quantos bytes do começo do disco bastam para reconhecer o console (assinatura + pasta raiz do ISO). */
    public static final int BYTES_DO_DISCO = 8 * 1024 * 1024;

    private static int le32(byte[] c, int o) { return (c[o] & 0xff) | (c[o + 1] & 0xff) << 8 | (c[o + 2] & 0xff) << 16 | (c[o + 3] & 0xff) << 24; }

    /** Console de um disco (.iso) pelo começo dele: GameCube/Wii pela assinatura; PSP, PS2 e PS1 pelo que há na pasta raiz do ISO 9660. */
    public static Plataformas.P plataformaDoCabecalho(byte[] c, int n) {
        if (c == null) return null;
        if (n >= 0x20 && (c[0x1C] & 0xff) == 0xC2 && (c[0x1D] & 0xff) == 0x33 && (c[0x1E] & 0xff) == 0x9F && (c[0x1F] & 0xff) == 0x3D) return Plataformas.porId("gamecube");
        if (n >= 0x1C && (c[0x18] & 0xff) == 0x5D && (c[0x19] & 0xff) == 0x1C && (c[0x1A] & 0xff) == 0x9E && (c[0x1B] & 0xff) == 0xA3) return Plataformas.porId("wii");
        int pvd = 0x8000;
        if (n < pvd + 170 || c[pvd + 1] != 'C' || c[pvd + 2] != 'D' || c[pvd + 3] != '0' || c[pvd + 4] != '0' || c[pvd + 5] != '1') return null;
        long raizLba = le32(c, pvd + 158) & 0xffffffffL, raizTam = le32(c, pvd + 166) & 0xffffffffL;
        long ini = raizLba * 2048L;
        if (raizTam <= 0 || raizTam > 65536 || ini + raizTam > n) return null;
        int o = (int) ini, fim = (int) (ini + raizTam);
        boolean psp = false;
        while (o < fim) {
            int len = c[o] & 0xff;
            if (len == 0) { o = (o / 2048 + 1) * 2048; continue; } // o fim de um setor: o próximo registro começa no setor seguinte
            int nl = c[o + 32] & 0xff;
            if (o + 33 + nl > n) break;
            String nome = new String(c, o + 33, nl, java.nio.charset.StandardCharsets.ISO_8859_1).toUpperCase(Locale.ROOT);
            int ponto = nome.indexOf(';');
            if (ponto >= 0) nome = nome.substring(0, ponto);
            if (nome.equals("PSP_GAME")) psp = true;
            if (nome.equals("SYSTEM.CNF")) {
                long lba = le32(c, o + 2) & 0xffffffffL, tam = le32(c, o + 10) & 0xffffffffL;
                long de = lba * 2048L;
                if (tam > 0 && tam < 4096 && de + tam <= n) {
                    String t = new String(c, (int) de, (int) tam, java.nio.charset.StandardCharsets.ISO_8859_1).toUpperCase(Locale.ROOT);
                    if (t.contains("BOOT2")) return Plataformas.porId("ps2");
                    if (t.contains("BOOT")) return Plataformas.porId("ps1");
                }
            }
            o += len;
        }
        return psp ? Plataformas.porId("psp") : null;
    }

    static Plataformas.P plataformaDoArquivo(File f) {
        try (java.io.FileInputStream in = new java.io.FileInputStream(f)) {
            byte[] b = new byte[BYTES_DO_DISCO];
            int n = 0, r;
            while (n < b.length && (r = in.read(b, n, b.length - n)) > 0) n += r;
            return plataformaDoCabecalho(b, n);
        } catch (Exception e) { return null; }
    }

    /** Pela pasta (mais perto do arquivo primeiro) ou, se ninguém reclama a extensão, pela extensão. */
    public static Plataformas.P identificar(File arquivo, File raiz) {
        String nome = arquivo.getName();
        int ponto = nome.lastIndexOf('.');
        if (ponto < 0) return null;
        String ext = nome.substring(ponto + 1).toLowerCase(Locale.ROOT);
        if (ext.equals("iso") || ext.equals("gcm")) { Plataformas.P h = plataformaDoArquivo(arquivo); if (h != null) return h; }
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

    /** Código (6 letras) e nome do jogo gravados no começo de um disco de GameCube/Wii. null se o arquivo não tiver esse cabeçalho. */
    static String[] cabecalhoNintendo(byte[] c, int n) {
        if (c == null || n < 0x60) return null;
        for (int i = 0; i < 6; i++) { int b = c[i] & 0xff; if (!((b >= '0' && b <= '9') || (b >= 'A' && b <= 'Z'))) return null; }
        int fim = 0x20;
        while (fim < 0x60 && c[fim] != 0) fim++;
        String nome = new String(c, 0x20, fim - 0x20, java.nio.charset.Charset.forName("ISO-8859-1")).trim();
        if (nome.isEmpty()) return null;
        return new String[]{new String(c, 0, 6, java.nio.charset.Charset.forName("US-ASCII")), nome};
    }

    static String[] cabecalhoNintendo(File f) {
        String n = f.getName().toLowerCase(Locale.ROOT);
        if (!n.endsWith(".iso") && !n.endsWith(".gcm")) return null;
        try (java.io.FileInputStream in = new java.io.FileInputStream(f)) {
            byte[] c = new byte[0x60];
            int lidos = 0, k;
            while (lidos < c.length && (k = in.read(c, lidos, c.length - lidos)) > 0) lidos += k;
            return cabecalhoNintendo(c, lidos);
        } catch (Exception e) { return null; }
    }

    /** A 4ª letra do código é a região: E = EUA, P = Europa, J = Japão. */
    static String regiaoDoCodigo(String codigo) {
        if (codigo == null || codigo.length() < 4) return null;
        switch (codigo.charAt(3)) {
            case 'E': return "EUA";
            case 'P': case 'D': case 'F': case 'S': case 'I': case 'X': case 'Y': case 'H': case 'U': return "Europa";
            case 'J': return "Japão";
            default: return null;
        }
    }

    static String titulo(String arquivo) {
        int ponto = arquivo.lastIndexOf('.');
        String s = ponto > 0 && arquivo.length() - ponto <= 6 ? arquivo.substring(0, ponto) : arquivo;
        s = arrumar(s.replaceAll("\\([^)]*\\)|\\[[^\\]]*\\]", " "));
        // "Legend of Zelda, The" -> "The Legend of Zelda"
        java.util.regex.Matcher m = java.util.regex.Pattern.compile("^(.*), (The|A|An|O|Os|As|Le|La|Les|El|Los|Las|Der|Die|Das|Il)( - .*)?$").matcher(s);
        if (m.matches()) s = m.group(2) + " " + m.group(1) + (m.group(3) == null ? "" : m.group(3));
        return s.isEmpty() ? arquivo : s;
    }

    /** Lixo que sobra depois das marcas (mesmas regras do Rust): site, número de catálogo, CamelCase, pontos e sublinhados, "copy". */
    static String arrumar(String bruto) {
        String n = bruto.trim();
        int w = n.toLowerCase(Locale.ROOT).indexOf("www.");
        if (w >= 0) { int fim = n.indexOf(' ', w); n = n.substring(0, w) + " " + (fim < 0 ? "" : n.substring(fim)); n = n.trim(); }
        if (!n.contains(" ")) { n = n.replace('_', ' ').replace('.', ' '); } else n = n.replace('_', ' ');
        if (!n.contains(" ") && contaCorcovas(n) >= 2) n = n.replaceAll("(?<=\\p{Ll})(?=\\p{Lu})", " ");
        n = n.replaceAll("\\s+", " ").trim();
        java.util.regex.Matcher c = java.util.regex.Pattern.compile("^(0\\d{3,4})\\s*(?:- |\\. |-)\\s*(.+)$").matcher(n);
        if (c.matches()) n = c.group(2).trim();
        else { java.util.regex.Matcher c2 = java.util.regex.Pattern.compile("^(\\d{4,5}) - (.+)$").matcher(n); if (c2.matches()) n = c2.group(2).trim(); } // "3298 - Pro Evolution Soccer 2014": número do site de ROMs
        while (true) {
            java.util.regex.Matcher k = java.util.regex.Pattern.compile("(?i)^(.{2,}?)(?: - copy| - c[oó]pia| copy| c[oó]pia)$").matcher(n);
            if (!k.matches()) break;
            n = k.group(1).trim();
        }
        return n.replaceAll("^[-\\s._]+|[-\\s._]+$", "");
    }

    private static int contaCorcovas(String n) {
        int k = 0;
        for (int i = 1; i < n.length(); i++) if (Character.isLowerCase(n.charAt(i - 1)) && Character.isUpperCase(n.charAt(i))) k++;
        return k;
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

    static List<String> chavesPublicas(JSONObject o) { return chaves(o); }

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

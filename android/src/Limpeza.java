package tech.vetorial.vortex;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.File;
import java.io.FileInputStream;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.zip.CRC32;
import java.util.zip.ZipFile;

/** Faxina da biblioteca (mesmo comportamento do Rust): um jogo por título (cópias vão para "Duplicados") e arquivos quebrados para "Corrompidos". Nada é apagado. */
public final class Limpeza {
    public static final String DUPLICADOS = "Duplicados", CORROMPIDOS = "Corrompidos";
    private static final long LIMITE_CRC = 64L * 1024 * 1024;

    private Limpeza() { }

    /** Motivo pelo qual o arquivo não presta; null quando parece bom. */
    public static String motivo(File f) {
        if (!f.isFile()) return null;
        String ext = Organizador.ext(f);
        long tam = f.length();
        if (tam == 0) return "arquivo vazio";
        byte[] c = new byte[16];
        int lidos = 0;
        try (FileInputStream in = new FileInputStream(f)) { lidos = Math.max(0, in.read(c)); } catch (Exception e) { return null; }
        String m = basico(f, ext, tam, c, lidos);
        return m != null ? m : profunda(f, ext, tam);
    }

    private static String basico(File f, String ext, long tam, byte[] c, int lidos) {
        switch (ext) {
            case "cue": {
                File dir = f.getParentFile();
                for (File ref : Organizador.acompanhantes(f)) if (!ref.isFile()) return "faltam arquivos do disco";
                try {
                    for (String l : java.nio.file.Files.readAllLines(f.toPath(), java.nio.charset.StandardCharsets.ISO_8859_1)) {
                        l = l.trim();
                        int a = l.indexOf('"'), b = l.lastIndexOf('"');
                        if (l.toUpperCase(Locale.ROOT).startsWith("FILE") && a >= 0 && b > a && !new File(dir, l.substring(a + 1, b)).isFile()) return "faltam arquivos do disco";
                    }
                } catch (Exception ignora) { }
                return null;
            }
            case "m3u": case "gdi": case "ccd": case "mds": case "sub": return null;
            case "zip":
                if (lidos < 4 || c[0] != 'P' || c[1] != 'K') return "zip danificado";
                try (ZipFile z = new ZipFile(f)) { z.size(); } catch (Exception e) { return "zip danificado"; }
                return null;
            case "7z":
                return lidos >= 6 && c[0] == '7' && c[1] == 'z' && (c[2] & 0xff) == 0xBC && (c[3] & 0xff) == 0xAF ? null : "7z danificado";
            case "nes":
                return lidos >= 4 && c[0] == 'N' && c[1] == 'E' && c[2] == 'S' && c[3] == 0x1A ? null : "cabeçalho NES inválido";
            case "z64": case "v64": case "n64":
                return lidos > 0 && ((c[0] & 0xff) == 0x80 || (c[0] & 0xff) == 0x37 || (c[0] & 0xff) == 0x40) ? null : "cabeçalho Nintendo 64 inválido";
            default:
                return tam < 512 ? "pequeno demais para ser um jogo" : null;
        }
    }

    private static long u32(byte[] h, int o) { return o + 4 > h.length ? 0 : (h[o] & 0xffL) | (h[o + 1] & 0xffL) << 8 | (h[o + 2] & 0xffL) << 16 | (h[o + 3] & 0xffL) << 24; }
    private static long u64(byte[] h, int o) { return u32(h, o) | u32(h, o + 4) << 32; }
    private static boolean texto(byte[] h, int o, String t) { if (o + t.length() > h.length) return false; for (int i = 0; i < t.length(); i++) if (h[o + i] != (byte) t.charAt(i)) return false; return true; }

    /** Confere o cabeçalho de verdade (e o tamanho que ele promete) para pegar download incompleto: o arquivo existe mas está cortado. */
    static String profunda(File f, String ext, long tam) {
        byte[] h = new byte[65536];
        int n = 0;
        try (FileInputStream in = new FileInputStream(f)) { int l; while (n < h.length && (l = in.read(h, n, h.length - n)) > 0) n += l; } catch (Exception e) { return null; }
        if (n < h.length) h = java.util.Arrays.copyOf(h, n);
        switch (ext) {
            case "nsp": {
                if (!texto(h, 0, "PFS0")) return "cabeçalho NSP inválido";
                long cont = u32(h, 4), strs = u32(h, 8);
                if (cont <= 0 || cont > 2000 || 16 + 24 * cont > h.length) return cont <= 0 || cont > 2000 ? "cabeçalho NSP inválido" : null;
                long fim = 0;
                for (int i = 0; i < cont; i++) fim = Math.max(fim, u64(h, (int) (16 + 24 * i)) + u64(h, (int) (16 + 24 * i + 8)));
                return tam < 16 + 24 * cont + strs + fim ? "download incompleto (faltam " + ((16 + 24 * cont + strs + fim - tam) / 1048576) + " MB)" : null;
            }
            case "xci": {
                if (!texto(h, 0x100, "HEAD")) return "cabeçalho XCI inválido";
                long fim = u32(h, 0x118) * 512;
                return fim > 0 && tam < fim ? "download incompleto (faltam " + ((fim - tam) / 1048576) + " MB)" : null;
            }
            case "3ds": return texto(h, 0x100, "NCSD") ? null : "cabeçalho 3DS inválido";
            case "nds": {
                if (h.length < 0x200 || u32(h, 0x15C) % 65536 != 0xCF56) return "cabeçalho Nintendo DS inválido";
                long usado = u32(h, 0x80);
                return usado > 0 && tam < usado ? "download incompleto" : null;
            }
            case "gba": return h.length >= 0xC0 && (h[0xB2] & 0xff) == 0x96 ? null : "cabeçalho Game Boy Advance inválido";
            case "gb": case "gbc": return h.length >= 0x108 && (h[0x104] & 0xff) == 0xCE && (h[0x105] & 0xff) == 0xED && h[0x106] == 0x66 && h[0x107] == 0x66 ? null : "cabeçalho Game Boy inválido";
            case "chd": return texto(h, 0, "MComprHD") ? null : "cabeçalho CHD inválido";
            case "cso": case "ciso": return texto(h, 0, "CISO") ? null : "cabeçalho CSO inválido";
            case "iso": {
                if (tam < 65536) return "pequeno demais para ser um jogo";
                long blocos; int sec;
                if (texto(h, 0x8001, "CD001")) { blocos = u32(h, 0x8050); sec = 2048; }
                else if (texto(h, 0x9319, "CD001")) { blocos = u32(h, 0x9368); sec = 2352; }
                else return null;
                return blocos > 0 && tam < blocos * sec * 0.995 ? "download incompleto" : null;
            }
            default: return null;
        }
    }

    // ---- ordem de preferência entre versões do mesmo jogo (menor = melhor)
    static int ordemRegiao(String arquivo) {
        Matcher m = Pattern.compile("\\(([^)]*)\\)").matcher(arquivo);
        int melhor = 50;
        String[] ordem = {"brazil|brasil|br", "usa|us|u", "world|w", "europe|eur|e", "uk", "japan|jpn|j"};
        while (m.find()) for (String t : m.group(1).split(",")) {
            String x = t.trim().toLowerCase(Locale.ROOT);
            for (int i = 0; i < ordem.length; i++) if (java.util.Arrays.asList(ordem[i].split("\\|")).contains(x)) melhor = Math.min(melhor, i);
        }
        return melhor;
    }

    static int marcas(String arquivo) {
        String b = arquivo.toLowerCase(Locale.ROOT);
        int n = 0;
        for (String s : new String[]{"(beta", "(proto", "(demo", "(sample", "(unl", "(hack", "(pirate", "(alt", "(kiosk", "[b", "[h", "[o"}) if (b.contains(s)) n++;
        return n;
    }

    static int disco(String arquivo) {
        Matcher m = Pattern.compile("(?i)\\((?:disc|disk|cd)\\s*(\\d+)").matcher(arquivo);
        return m.find() ? Integer.parseInt(m.group(1)) : 0;
    }

    static String grupo(JSONObject j) {
        String nome = new File(j.optString("caminho")).getName();
        return j.optString("plataforma") + "|" + Motor.normalizar(Motor.titulo(nome)) + "|" + disco(nome);
    }

    static final Comparator<JSONObject> MELHOR = new Comparator<JSONObject>() {
        public int compare(JSONObject a, JSONObject b) {
            String na = new File(a.optString("caminho")).getName(), nb = new File(b.optString("caminho")).getName();
            int c = Integer.compare(ordemRegiao(na), ordemRegiao(nb));
            if (c == 0) c = Integer.compare(marcas(na), marcas(nb));
            if (c == 0) c = Integer.compare(na.length(), nb.length());
            if (c == 0) c = na.compareTo(nb);
            return c;
        }
    };

    private static boolean mover(File arq, File pasta, List<String> falhas) {
        List<File> grupo = new ArrayList<File>();
        grupo.add(arq);
        grupo.addAll(Organizador.acompanhantes(arq));
        for (File g : grupo) {
            try { Organizador.mover(g, Organizador.livre(new File(pasta, g.getName()))); } catch (Exception e) { falhas.add(g.getPath() + ": " + e.getMessage()); return false; }
        }
        return true;
    }

    private static Long crc(File f) {
        if (f.length() > LIMITE_CRC) return null;
        try (FileInputStream in = new FileInputStream(f)) {
            CRC32 c = new CRC32();
            byte[] buf = new byte[262144]; int n;
            while ((n = in.read(buf)) > 0) c.update(buf, 0, n);
            return c.getValue();
        } catch (Exception e) { return null; }
    }

    /** Tira um jogo que não abriu da biblioteca e guarda o arquivo na pasta Corrompidos. */
    public static JSONObject isolar(JSONObject jogos, String id) throws Exception {
        JSONObject j = jogos.optJSONObject(id);
        if (j == null) throw new Exception("Esse jogo não está mais na biblioteca.");
        List<String> falhas = new ArrayList<String>();
        File f = new File(j.optString("caminho"));
        if (f.isFile() && !mover(f, new File(j.optString("raiz"), CORROMPIDOS), falhas)) throw new Exception(falhas.isEmpty() ? "Não consegui mover o arquivo." : falhas.get(0));
        jogos.remove(id);
        return new JSONObject().put("isolado", true);
    }

    /** Remove da biblioteca (e do disco, para as pastas Duplicados/Corrompidos) o que não serve. Com simulação só conta. */
    public static JSONObject limpar(JSONObject jogos, boolean simulacao) throws Exception {
        JSONArray dup = new JSONArray(), cor = new JSONArray(), falhasJ = new JSONArray();
        List<String> falhas = new ArrayList<String>();
        List<String> saiu = new ArrayList<String>();
        List<String> ids = Motor.chavesPublicas(jogos);
        Collections.sort(ids);
        // 1) corrompidos
        for (String id : ids) {
            JSONObject j = jogos.getJSONObject(id);
            File f = new File(j.optString("caminho"));
            if (!j.optBoolean("disponivel", true) || !f.isFile()) continue;
            String m = motivo(f);
            if (m == null) continue;
            cor.put(f.getPath() + " (" + m + ")");
            if (simulacao || mover(f, new File(j.optString("raiz"), CORROMPIDOS), falhas)) saiu.add(id);
        }
        // 2) mesmo título em versões diferentes
        Map<String, List<JSONObject>> grupos = new HashMap<String, List<JSONObject>>();
        for (String id : ids) {
            if (saiu.contains(id)) continue;
            JSONObject j = jogos.getJSONObject(id);
            if (!j.optBoolean("disponivel", true) || !new File(j.optString("caminho")).isFile()) continue;
            String ext = Organizador.ext(new File(j.optString("caminho")));
            if (ext.equals("m3u")) continue;
            String g = grupo(j);
            List<JSONObject> l = grupos.get(g);
            if (l == null) { l = new ArrayList<JSONObject>(); grupos.put(g, l); }
            l.add(j);
        }
        for (List<JSONObject> l : grupos.values()) {
            if (l.size() < 2) continue;
            Collections.sort(l, MELHOR);
            for (int i = 1; i < l.size(); i++) {
                JSONObject j = l.get(i);
                File f = new File(j.optString("caminho"));
                dup.put(f.getPath());
                if (simulacao || mover(f, new File(j.optString("raiz"), DUPLICADOS), falhas)) saiu.add(j.getString("id"));
            }
        }
        // 3) mesmo conteúdo com nomes diferentes
        Map<String, List<JSONObject>> porTam = new HashMap<String, List<JSONObject>>();
        for (String id : ids) {
            if (saiu.contains(id)) continue;
            JSONObject j = jogos.getJSONObject(id);
            File f = new File(j.optString("caminho"));
            String ext = Organizador.ext(f);
            if (!j.optBoolean("disponivel", true) || !f.isFile() || f.length() == 0 || ext.equals("cue") || ext.equals("m3u") || ext.equals("gdi")) continue;
            String k = j.optString("plataforma") + "|" + f.length();
            List<JSONObject> l = porTam.get(k);
            if (l == null) { l = new ArrayList<JSONObject>(); porTam.put(k, l); }
            l.add(j);
        }
        for (List<JSONObject> l : porTam.values()) {
            if (l.size() < 2) continue;
            Map<Long, List<JSONObject>> porCrc = new HashMap<Long, List<JSONObject>>();
            for (JSONObject j : l) {
                Long c = crc(new File(j.optString("caminho")));
                if (c == null) continue;
                List<JSONObject> x = porCrc.get(c);
                if (x == null) { x = new ArrayList<JSONObject>(); porCrc.put(c, x); }
                x.add(j);
            }
            for (List<JSONObject> iguais : porCrc.values()) {
                if (iguais.size() < 2) continue;
                Collections.sort(iguais, MELHOR);
                for (int i = 1; i < iguais.size(); i++) {
                    JSONObject j = iguais.get(i);
                    File f = new File(j.optString("caminho"));
                    dup.put(f.getPath());
                    if (simulacao || mover(f, new File(j.optString("raiz"), DUPLICADOS), falhas)) saiu.add(j.getString("id"));
                }
            }
        }
        if (!simulacao) for (String id : saiu) jogos.remove(id);
        for (String f : falhas) falhasJ.put(f);
        return new JSONObject().put("duplicados", dup).put("corrompidos", cor).put("falhas", falhasJ).put("simulacao", simulacao);
    }
}

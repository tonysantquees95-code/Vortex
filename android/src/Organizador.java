package tech.vetorial.vortex;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.zip.ZipEntry;
import java.util.zip.ZipFile;

/** Organizador automático (mesmo comportamento do Rust): acha jogos soltos, descompacta, guarda na pasta do Vortex, uma pasta por console, e registra para desfazer. */
public class Organizador {
    public static final class Item {
        public final File origem, destino;
        public final String plataforma;
        public final boolean extraido;
        Item(File o, File d, String p, boolean e) { origem = o; destino = d; plataforma = p; extraido = e; }
        JSONObject json() throws Exception { return new JSONObject().put("origem", origem.getPath()).put("destino", destino.getPath()).put("plataforma", plataforma).put("extraido", extraido); }
    }

    public static final class Resultado {
        public final List<Item> organizados = new ArrayList<Item>();
        public final List<Item> registro = new ArrayList<Item>();
        public final List<String> falhas = new ArrayList<String>();
    }

    private static final Set<String> IGNORAR = new HashSet<String>(java.util.Arrays.asList("windows", "android", "appdata", "node_modules", "lost.dir"));

    public static List<File> candidatos(List<String> raizes) {
        String[] nomes = {"Download", "Downloads", "Documents", "Documentos", "Roms", "ROMs", "Games", "Jogos", "Emulation", "Emulacao", "Retro"};
        List<File> r = new ArrayList<File>();
        for (String raiz : raizes) for (String n : nomes) { File f = new File(raiz, n); if (f.isDirectory() && !r.contains(f)) r.add(f); }
        return r;
    }

    static String nomeDePasta(Plataformas.P p) { return p.nome.replaceAll("[<>:\"/\\\\|?*]", "-").trim(); }

    static File livre(File d) {
        if (!d.exists()) return d;
        String n = d.getName();
        int ponto = n.lastIndexOf('.');
        String stem = ponto > 0 ? n.substring(0, ponto) : n, ext = ponto > 0 ? n.substring(ponto) : "";
        for (int i = 2; ; i++) { File c = new File(d.getParentFile(), stem + " (" + i + ")" + ext); if (!c.exists()) return c; }
    }

    static void mover(File de, File para) throws Exception {
        File pai = para.getParentFile();
        if (pai != null) pai.mkdirs();
        if (de.renameTo(para)) return;
        Files.copy(de.toPath(), para.toPath());
        if (!de.delete()) throw new Exception("Não consegui apagar " + de.getPath());
    }

    static String ext(File f) { String n = f.getName(); int p = n.lastIndexOf('.'); return p < 0 ? "" : n.substring(p + 1).toLowerCase(Locale.ROOT); }

    static List<File> acompanhantes(File arq) {
        List<File> v = new ArrayList<File>();
        String e = ext(arq);
        File dir = arq.getParentFile();
        if (dir == null) return v;
        if (e.equals("cue") || e.equals("gdi") || e.equals("m3u")) {
            try {
                for (String l : Files.readAllLines(arq.toPath(), StandardCharsets.ISO_8859_1)) {
                    l = l.trim();
                    String alvo = null;
                    int a = l.indexOf('"'), b = l.lastIndexOf('"');
                    if (a >= 0 && b > a) alvo = l.substring(a + 1, b); else if (!e.equals("cue") && !l.isEmpty() && !l.startsWith("#")) alvo = l;
                    if (alvo != null && !alvo.isEmpty()) { File p = new File(dir, alvo); if (p.isFile() && !p.equals(arq) && !v.contains(p)) v.add(p); }
                }
            } catch (Exception ignora) { }
        }
        if (e.equals("cue") || e.equals("ccd") || e.equals("mds")) {
            String stem = arq.getName().substring(0, arq.getName().lastIndexOf('.'));
            File[] fs = dir.listFiles();
            if (fs != null) for (File p : fs) {
                String n = p.getName();
                int ponto = n.lastIndexOf('.');
                if (!p.equals(arq) && p.isFile() && ponto > 0 && n.substring(0, ponto).equals(stem) && java.util.Arrays.asList("bin", "img", "sub", "iso", "mdf").contains(ext(p)) && !v.contains(p)) v.add(p);
            }
        }
        return v;
    }

    static List<String> nomesDoZip(File z) {
        List<String> r = new ArrayList<String>();
        try (ZipFile zf = new ZipFile(z)) {
            java.util.Enumeration<? extends ZipEntry> en = zf.entries();
            while (en.hasMoreElements() && r.size() < 200) { ZipEntry e = en.nextElement(); if (!e.isDirectory()) r.add(e.getName()); }
        } catch (Exception ignora) { }
        return r;
    }

    static Plataformas.P dentroDoZip(List<String> nomes) {
        for (String n : nomes) {
            int p = n.lastIndexOf('.');
            if (p < 0) continue;
            Plataformas.P x = Motor.unicaPelaExtensao(n.substring(p + 1).toLowerCase(Locale.ROOT));
            if (x != null) return x;
        }
        return null;
    }

    static File extrair(File zip, File pasta, Plataformas.P plat) throws Exception {
        try (ZipFile zf = new ZipFile(zip)) {
            int arquivos = 0;
            java.util.Enumeration<? extends ZipEntry> en = zf.entries();
            while (en.hasMoreElements()) if (!en.nextElement().isDirectory()) arquivos++;
            String nz = zip.getName();
            String stem = nz.contains(".") ? nz.substring(0, nz.lastIndexOf('.')) : nz;
            File base = arquivos <= 1 ? pasta : livre(new File(pasta, stem));
            base.mkdirs();
            String baseCanon = base.getCanonicalPath() + File.separator;
            File principal = base;
            en = zf.entries();
            while (en.hasMoreElements()) {
                ZipEntry e = en.nextElement();
                if (e.isDirectory()) continue;
                String rel = arquivos <= 1 ? new File(e.getName()).getName() : e.getName();
                File alvo = arquivos <= 1 ? livre(new File(base, rel)) : new File(base, rel);
                if (!alvo.getCanonicalPath().startsWith(baseCanon)) continue; // ignora caminhos que tentam sair da pasta
                if (alvo.getParentFile() != null) alvo.getParentFile().mkdirs();
                try (InputStream in = zf.getInputStream(e); OutputStream out = new FileOutputStream(alvo)) {
                    byte[] buf = new byte[65536]; int n;
                    while ((n = in.read(buf)) > 0) out.write(buf, 0, n);
                }
                if (arquivos <= 1 || (principal.equals(base) && java.util.Arrays.asList(plat.extensoes).contains(ext(alvo)))) principal = alvo;
            }
            return principal;
        }
    }

    static void percorrer(File dir, File fora, int nivel, List<File> saida) {
        if (nivel > 6) return;
        File[] fs = dir.listFiles();
        if (fs == null) return;
        for (File p : fs) {
            String n = p.getName();
            if (n.startsWith(".") || p.getAbsolutePath().startsWith(fora.getAbsolutePath())) continue;
            if (p.isDirectory()) { if (!IGNORAR.contains(n.toLowerCase(Locale.ROOT))) percorrer(p, fora, nivel + 1, saida); } else saida.add(p);
        }
    }

    public static Resultado organizar(List<File> origens, File vortex, boolean simulacao) {
        Resultado r = new Resultado();
        Set<File> feitos = new HashSet<File>();
        for (File raiz : origens) {
            if (!raiz.isDirectory() || raiz.getAbsolutePath().startsWith(vortex.getAbsolutePath())) continue;
            List<File> todos = new ArrayList<File>();
            percorrer(raiz, vortex, 0, todos);
            Collections.sort(todos);
            Set<File> acomp = new HashSet<File>();
            for (File a : todos) if (java.util.Arrays.asList("cue", "gdi", "m3u", "ccd", "mds").contains(ext(a))) acomp.addAll(acompanhantes(a));
            for (File arq : todos) {
                if (feitos.contains(arq) || acomp.contains(arq) || !arq.exists()) continue;
                String e = ext(arq);
                Plataformas.P plat;
                boolean doZip = false;
                if (e.equals("zip")) {
                    Plataformas.P pasta = Motor.plataformaDaPasta(arq, raiz);
                    if (pasta != null && pasta.id.equals("arcade")) plat = pasta; else { plat = dentroDoZip(nomesDoZip(arq)); doZip = true; }
                } else plat = Motor.identificar(arq, raiz);
                if (plat == null) continue;
                File pasta = new File(vortex, nomeDePasta(plat));
                feitos.add(arq);
                try {
                    if (doZip) {
                        if (simulacao) { r.organizados.add(new Item(arq, pasta, plat.id, true)); continue; }
                        File dest = extrair(arq, pasta, plat);
                        arq.delete();
                        Item it = new Item(arq, dest, plat.id, true);
                        r.registro.add(it); r.organizados.add(it);
                        continue;
                    }
                    List<File> grupo = new ArrayList<File>();
                    grupo.add(arq);
                    grupo.addAll(acompanhantes(arq));
                    File pastaJogo = grupo.size() > 1 ? new File(pasta, arq.getName().substring(0, arq.getName().lastIndexOf('.'))) : pasta;
                    feitos.addAll(grupo);
                    File destino = livre(new File(pastaJogo, arq.getName()));
                    if (simulacao) { r.organizados.add(new Item(arq, destino, plat.id, false)); continue; }
                    for (File g : grupo) {
                        File d = g.equals(arq) ? destino : livre(new File(pastaJogo, g.getName()));
                        mover(g, d);
                        r.registro.add(new Item(g, d, plat.id, false));
                    }
                    r.organizados.add(new Item(arq, destino, plat.id, false));
                } catch (Exception ex) {
                    r.falhas.add(arq.getName() + ": " + ex.getMessage());
                }
            }
        }
        return r;
    }

    public static JSONObject desfazer(JSONArray movimentos) throws Exception {
        int n = 0;
        JSONArray falhas = new JSONArray();
        for (int i = movimentos.length() - 1; i >= 0; i--) {
            JSONObject m = movimentos.getJSONObject(i);
            if (m.optBoolean("extraido")) continue;
            File o = new File(m.getString("origem")), d = new File(m.getString("destino"));
            if (o.exists()) { falhas.put(o.getPath() + " já existe; deixei o jogo em " + d.getPath() + "."); continue; }
            try { mover(d, o); n++; } catch (Exception ex) { falhas.put(String.valueOf(ex.getMessage())); }
        }
        return new JSONObject().put("devolvidos", n).put("falhas", falhas);
    }
}

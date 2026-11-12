package tech.vetorial.vortex;

import org.apache.commons.compress.archivers.sevenz.SevenZArchiveEntry;
import org.apache.commons.compress.archivers.sevenz.SevenZFile;

import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/** Abre .7z (jogos baixados em 7z): descobre o console pelo conteúdo e extrai para a pasta do console. Só existe no app. */
public final class Arquivo7z {
    private Arquivo7z() { }

    /** O console do que está dentro: pela extensão e, para .iso, pela assinatura do disco. null se não reconhece.
     *  Só lê a lista de nomes e o começo de UM .iso: num 7z "sólido" passar de arquivo em arquivo descompactaria tudo (minutos). */
    @SuppressWarnings("deprecation")
    public static Plataformas.P identificar(File arquivo) throws Exception {
        try (SevenZFile s = new SevenZFile(arquivo)) {
            SevenZArchiveEntry iso = null;
            for (SevenZArchiveEntry e : s.getEntries()) {
                if (e.isDirectory()) continue;
                String nome = e.getName();
                int p = nome.lastIndexOf('.');
                if (p < 0) continue;
                String ext = nome.substring(p + 1).toLowerCase(Locale.ROOT);
                Plataformas.P x = Motor.unicaPelaExtensao(ext);
                if (x != null) return x;
                if (ext.equals("cso") || ext.equals("pbp")) return Plataformas.porId("psp");
                if (ext.equals("iso") && iso == null) iso = e;
            }
            if (iso == null) return null;
            byte[] b = new byte[Motor.BYTES_DO_DISCO];
            int n = 0, r;
            try (java.io.InputStream in = s.getInputStream(iso)) {
                while (n < b.length && (r = in.read(b, n, b.length - n)) > 0) n += r;
            }
            return Motor.plataformaDoCabecalho(b, n);
        }
    }

    /** Extrai para [pasta] (um arquivo só vai direto; vários vão para uma subpasta com o nome do .7z). Devolve o arquivo principal. */
    @SuppressWarnings("deprecation")
    public static File extrair(File arquivo, File pasta, Plataformas.P plat) throws Exception {
        List<File> criados = new ArrayList<File>();
        try (SevenZFile s = new SevenZFile(arquivo)) {
            int arquivos = 0;
            for (SevenZArchiveEntry e : s.getEntries()) if (!e.isDirectory()) arquivos++;
            String nz = arquivo.getName();
            String stem = nz.contains(".") ? nz.substring(0, nz.lastIndexOf('.')) : nz;
            File base = arquivos <= 1 ? pasta : Organizador.livre(new File(pasta, stem));
            base.mkdirs();
            String baseCanon = base.getCanonicalPath() + File.separator;
            File principal = base;
            SevenZArchiveEntry e;
            byte[] buf = new byte[1 << 20];
            while ((e = s.getNextEntry()) != null) {
                if (e.isDirectory()) continue;
                String rel = arquivos <= 1 ? new File(e.getName()).getName() : e.getName();
                File alvo = arquivos <= 1 ? Organizador.livre(new File(base, rel)) : new File(base, rel);
                if (!alvo.getCanonicalPath().startsWith(baseCanon)) continue; // ignora caminhos que tentam sair da pasta
                if (alvo.getParentFile() != null) alvo.getParentFile().mkdirs();
                criados.add(alvo);
                try (OutputStream out = new FileOutputStream(alvo)) {
                    int n;
                    while ((n = s.read(buf)) > 0) out.write(buf, 0, n);
                }
                String nome = alvo.getName();
                int p = nome.lastIndexOf('.');
                String ext = p < 0 ? "" : nome.substring(p + 1).toLowerCase(Locale.ROOT);
                if (arquivos <= 1 || (principal.equals(base) && java.util.Arrays.asList(plat.extensoes).contains(ext))) principal = alvo;
            }
            return principal;
        } catch (Throwable ex) {
            for (File f : criados) f.delete(); // não deixa um jogo pela metade na biblioteca
            if (ex instanceof Exception) throw (Exception) ex;
            throw new Exception(ex);
        }
    }
}

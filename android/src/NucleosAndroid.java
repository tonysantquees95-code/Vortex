package tech.vetorial.vortex;

import android.content.Context;
import android.os.Build;

import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;

/** Núcleos de emulação embutidos: o Vortex baixa o núcleo do console (repositório oficial da Libretro) só na primeira vez e guarda na pasta do app. */
public final class NucleosAndroid {
    private NucleosAndroid() {}

    public static String abi() {
        for (String a : Build.SUPPORTED_ABIS) if (a.equals("arm64-v8a") || a.equals("armeabi-v7a") || a.equals("x86_64")) return a;
        return null;
    }

    public static String url(String nucleo, String abi) {
        return "https://buildbot.libretro.com/nightly/android/latest/" + abi + "/" + nucleo + "_android.so.zip";
    }

    public static File arquivo(Context c, String nucleo) {
        return new File(new File(c.getFilesDir(), "cores"), nucleo + "_android.so");
    }

    /** Garante o núcleo no aparelho. Devolve true se precisou baixar agora. */
    public static boolean garantir(Context c, String nucleo) throws Exception {
        File so = arquivo(c, nucleo);
        if (so.isFile() && so.length() > 0) return false;
        String abi = abi();
        if (abi == null) throw new Exception("Este aparelho não é compatível com o motor de emulação do Vortex.");
        so.getParentFile().mkdirs();
        File tmp = new File(so.getPath() + ".baixando");
        HttpURLConnection h = (HttpURLConnection) new URL(url(nucleo, abi)).openConnection();
        h.setConnectTimeout(20000);
        h.setReadTimeout(60000);
        if (h.getResponseCode() != 200) throw new Exception("Não consegui baixar o motor deste console (erro " + h.getResponseCode() + "). Confira a internet e tente de novo.");
        boolean achou = false;
        try (ZipInputStream z = new ZipInputStream(h.getInputStream())) {
            ZipEntry e;
            while ((e = z.getNextEntry()) != null) {
                if (e.isDirectory() || !e.getName().endsWith(".so")) continue;
                try (OutputStream out = new FileOutputStream(tmp)) {
                    byte[] buf = new byte[65536]; int n;
                    while ((n = z.read(buf)) > 0) out.write(buf, 0, n);
                }
                achou = true;
                break;
            }
        } finally { h.disconnect(); }
        if (!achou) { tmp.delete(); throw new Exception("O motor baixado veio incompleto. Tente de novo."); }
        so.delete();
        if (!tmp.renameTo(so)) throw new Exception("Não consegui guardar o motor baixado.");
        so.setReadOnly(); // o Android recusa carregar código gravável baixado depois da instalação
        return true;
    }

    /** Arquivos de sistema que alguns núcleos exigem (o Dolphin precisa da pasta "dolphin-emu/Sys"; sem ela o jogo abre e fica tudo preto). Devolve true se baixou agora. */
    public static boolean garantirSistema(Context c, String nucleo) throws Exception {
        if (!nucleo.startsWith("dolphin")) return false;
        File sistema = new File(c.getFilesDir(), "system");
        File sys = new File(sistema, "dolphin-emu/Sys");
        if (new File(sys, "GC").isDirectory() && new File(sys, "Wii").isDirectory()) return false;
        sistema.mkdirs();
        HttpURLConnection h = (HttpURLConnection) new URL("https://buildbot.libretro.com/assets/system/Dolphin.zip").openConnection();
        h.setConnectTimeout(20000);
        h.setReadTimeout(60000);
        if (h.getResponseCode() != 200) throw new Exception("Não consegui baixar os arquivos de sistema do GameCube/Wii (erro " + h.getResponseCode() + "). Confira a internet e tente de novo.");
        String raiz = sistema.getCanonicalPath() + File.separator;
        int arquivos = 0;
        try (ZipInputStream z = new ZipInputStream(h.getInputStream())) {
            ZipEntry e;
            while ((e = z.getNextEntry()) != null) {
                File alvo = new File(sistema, e.getName());
                if (!alvo.getCanonicalPath().startsWith(raiz)) continue; // nunca grava fora da pasta de sistema
                if (e.isDirectory()) { alvo.mkdirs(); continue; }
                alvo.getParentFile().mkdirs();
                try (OutputStream out = new FileOutputStream(alvo)) {
                    byte[] buf = new byte[65536]; int n;
                    while ((n = z.read(buf)) > 0) out.write(buf, 0, n);
                }
                arquivos++;
            }
        } finally { h.disconnect(); }
        if (arquivos == 0 || !new File(sys, "GC").isDirectory()) throw new Exception("Os arquivos de sistema do GameCube/Wii vieram incompletos. Tente de novo.");
        return true;
    }
}

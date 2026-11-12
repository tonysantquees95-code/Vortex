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
}

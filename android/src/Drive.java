package tech.vetorial.vortex;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.net.URLEncoder;
import java.nio.channels.Channels;
import java.nio.charset.StandardCharsets;

/** Vetorial Drive: arquivos da conta (documentos e ROMs). Envio em partes que podem ser repetidas, download que continua de onde parou. */
public final class Drive {
    public interface Progresso { void aoAvancar(long feito, long total); }
    public static final class Cancelado extends Exception { Cancelado() { super("Cancelado."); } }

    /** Cancela a transferência em andamento. */
    public static volatile boolean cancelar = false;

    private static String token(File dados) throws Exception {
        JSONObject c = Nuvem.lerConta(dados);
        if (c == null) throw new Exception("Entre na sua conta Vetorial ID para usar o Vetorial Drive.");
        return c.getString("token");
    }

    private static String enc(String s) throws Exception { return URLEncoder.encode(s, "UTF-8").replace("+", "%20"); }

    private static String erro(HttpURLConnection c) {
        try {
            InputStream e = c.getErrorStream();
            if (e != null) {
                java.io.ByteArrayOutputStream o = new java.io.ByteArrayOutputStream();
                byte[] b = new byte[2048]; int n; while ((n = e.read(b)) > 0 && o.size() < 8192) o.write(b, 0, n);
                String m = new JSONObject(o.toString("UTF-8")).optString("error", "");
                if (!m.isEmpty()) return m;
            }
        } catch (Exception ignora) { }
        try { return "O servidor respondeu " + c.getResponseCode() + "."; } catch (Exception e) { return "Sem conexão com o servidor da Vetorial."; }
    }

    private static HttpURLConnection abrir(String metodo, String caminho, String token) throws Exception {
        HttpURLConnection c = (HttpURLConnection) new URL(Nuvem.SERVIDOR + caminho).openConnection();
        c.setConnectTimeout(15000); c.setReadTimeout(60000);
        c.setRequestMethod(metodo);
        c.setRequestProperty("Authorization", "Bearer " + token);
        return c;
    }

    private static JSONObject json(HttpURLConnection c, String corpo) throws Exception {
        if (corpo != null) {
            c.setDoOutput(true);
            c.setRequestProperty("Content-Type", "application/json");
            try (OutputStream o = c.getOutputStream()) { o.write(corpo.getBytes(StandardCharsets.UTF_8)); }
        }
        int st;
        try { st = c.getResponseCode(); } catch (java.io.IOException e) { throw new Exception("Sem conexão com o servidor da Vetorial."); }
        if (st >= 400) throw new Exception(erro(c));
        try (InputStream in = c.getInputStream()) {
            java.io.ByteArrayOutputStream o = new java.io.ByteArrayOutputStream();
            byte[] b = new byte[4096]; int n; while ((n = in.read(b)) > 0) o.write(b, 0, n);
            return new JSONObject(o.toString("UTF-8"));
        } finally { c.disconnect(); }
    }

    public static JSONObject lista(File dados) throws Exception { return json(abrir("GET", "/drive/arquivos", token(dados)), null); }

    public static JSONObject apagar(File dados, String pasta, String nome) throws Exception {
        return json(abrir("DELETE", "/drive/arquivo/" + enc(pasta + "/" + nome), token(dados)), null);
    }

    /** Envia o arquivo (descritor já aberto) em partes. */
    public static JSONObject enviar(File dados, android.os.ParcelFileDescriptor pfd, long tamanho, String pasta, String nome, Progresso p) throws Exception {
        cancelar = false;
        String tk = token(dados);
        JSONObject ini = json(abrir("POST", "/drive/enviar", tk), new JSONObject().put("pasta", pasta).put("nome", nome).put("tamanho", tamanho).toString());
        String envio = ini.getString("envio");
        long parte = Math.max(1024 * 1024, ini.optLong("parte", 32L * 1024 * 1024));
        JSONArray partes = new JSONArray();
        try (FileInputStream fis = new FileInputStream(pfd.getFileDescriptor())) {
            long feito = 0; int n = 1;
            while (feito < tamanho) {
                if (cancelar) throw new Cancelado();
                long tam = Math.min(parte, tamanho - feito);
                JSONObject r = null; Exception ultimo = null;
                for (int tentativa = 0; tentativa < 4 && r == null; tentativa++) {
                    if (cancelar) throw new Cancelado();
                    try {
                        r = enviarParte(fis, tk, pasta, nome, envio, n, feito, tam, feito, tamanho, p);
                    } catch (Cancelado c) { throw c; }
                    catch (Exception e) { ultimo = e; Thread.sleep(1500L * (tentativa + 1)); }
                }
                if (r == null) throw ultimo != null ? ultimo : new Exception("Falha ao enviar.");
                partes.put(new JSONObject().put("n", r.getInt("n")).put("etag", r.getString("etag")));
                feito += tam; n++;
                if (p != null) p.aoAvancar(feito, tamanho);
            }
            JSONObject fim = json(abrir("POST", "/drive/concluir", tk), new JSONObject().put("pasta", pasta).put("nome", nome).put("envio", envio).put("partes", partes).toString());
            return fim;
        } catch (Exception e) {
            try { json(abrir("POST", "/drive/cancelar", tk), new JSONObject().put("pasta", pasta).put("nome", nome).put("envio", envio).toString()); } catch (Exception ignora) { }
            throw e;
        }
    }

    private static JSONObject enviarParte(FileInputStream fis, String tk, String pasta, String nome, String envio, int n, long inicio, long tam, long base, long total, Progresso p) throws Exception {
        fis.getChannel().position(inicio);
        HttpURLConnection c = abrir("PUT", "/drive/parte?pasta=" + enc(pasta) + "&nome=" + enc(nome) + "&envio=" + enc(envio) + "&n=" + n, tk);
        c.setReadTimeout(120000);
        c.setDoOutput(true);
        c.setFixedLengthStreamingMode(tam);
        c.setRequestProperty("Content-Type", "application/octet-stream");
        try (OutputStream o = c.getOutputStream(); InputStream in = Channels.newInputStream(fis.getChannel())) {
            byte[] b = new byte[64 * 1024]; long falta = tam, enviado = 0; int l;
            while (falta > 0 && (l = in.read(b, 0, (int) Math.min(b.length, falta))) > 0) {
                if (cancelar) throw new Cancelado();
                o.write(b, 0, l); falta -= l; enviado += l;
                if (p != null) p.aoAvancar(base + enviado, total);
            }
            if (falta > 0) throw new Exception("O arquivo mudou durante o envio.");
        }
        int st;
        try { st = c.getResponseCode(); } catch (java.io.IOException e) { throw new Exception("Sem conexão com o servidor da Vetorial."); }
        if (st >= 400) throw new Exception(erro(c));
        try (InputStream in = c.getInputStream()) {
            java.io.ByteArrayOutputStream ob = new java.io.ByteArrayOutputStream();
            byte[] b = new byte[2048]; int l; while ((l = in.read(b)) > 0) ob.write(b, 0, l);
            return new JSONObject(ob.toString("UTF-8"));
        } finally { c.disconnect(); }
    }

    /** Baixa para destino; se já existe um pedaço (.parte), continua dele. */
    public static File baixar(File dados, String pasta, String nome, File destino, Progresso p) throws Exception {
        cancelar = false;
        String tk = token(dados);
        File dir = destino.getParentFile();
        if (dir != null && !dir.isDirectory() && !dir.mkdirs()) throw new Exception("Não consegui criar a pasta de destino.");
        File parcial = new File(destino.getPath() + ".parte");
        long tem = parcial.isFile() ? parcial.length() : 0;
        HttpURLConnection c = abrir("GET", "/drive/arquivo/" + enc(pasta + "/" + nome), tk);
        if (tem > 0) c.setRequestProperty("Range", "bytes=" + tem + "-");
        int st;
        try { st = c.getResponseCode(); } catch (java.io.IOException e) { throw new Exception("Sem conexão com o servidor da Vetorial."); }
        if (st == 416 && tem > 0) { parcial.delete(); c.disconnect(); return baixar(dados, pasta, nome, destino, p); }
        if (st >= 400) throw new Exception(erro(c));
        boolean continua = st == 206;
        long total = c.getContentLengthLong() + (continua ? tem : 0);
        if (!continua) tem = 0;
        try (InputStream in = c.getInputStream(); FileOutputStream o = new FileOutputStream(parcial, continua)) {
            byte[] b = new byte[64 * 1024]; int l; long feito = tem;
            while ((l = in.read(b)) > 0) {
                if (cancelar) throw new Cancelado();
                o.write(b, 0, l); feito += l;
                if (p != null) p.aoAvancar(feito, total);
            }
            if (total > 0 && feito < total) throw new Exception("A conexão caiu. Toque em baixar de novo para continuar de onde parou.");
        } finally { c.disconnect(); }
        if (destino.exists() && !destino.delete()) throw new Exception("Não consegui substituir o arquivo antigo.");
        if (!parcial.renameTo(destino)) throw new Exception("Não consegui finalizar o arquivo baixado.");
        return destino;
    }
}

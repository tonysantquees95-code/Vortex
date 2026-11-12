package tech.vetorial.vortex;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.File;
import java.nio.file.Files;

/** Teste do motor do Android rodando no computador (sem o Android). */
public class MotorTeste {
    static int falhas = 0;

    static void confere(boolean ok, String o) {
        if (!ok) { falhas++; System.out.println("FALHOU: " + o); } else System.out.println("ok: " + o);
    }

    public static void main(String[] a) throws Exception {
        File t = Files.createTempDirectory("vortex").toFile();
        new File(t, "roms/snes").mkdirs();
        new File(t, "roms/psx").mkdirs();
        new File(t, "roms/misc").mkdirs();
        Files.write(new File(t, "roms/snes/Super Mario World (USA).sfc").toPath(), "x".getBytes());
        Files.write(new File(t, "roms/snes/Legend of Zelda, The - A Link to the Past (USA) [!].sfc").toPath(), "x".getBytes());
        Files.write(new File(t, "roms/psx/Crash Bandicoot.cue").toPath(), "x".getBytes());
        Files.write(new File(t, "roms/misc/Metroid Fusion.gba").toPath(), "x".getBytes());
        Files.write(new File(t, "roms/misc/leiame.txt").toPath(), "x".getBytes());
        Files.write(new File(t, "roms/misc/disco.iso").toPath(), "x".getBytes()); // .iso sem pasta de plataforma: ambíguo, ignora
        final long[] agora = {1000};
        Motor m = new Motor(() -> agora[0]);
        String bib = new File(t, "dados/biblioteca.json").getPath();
        java.util.function.BiFunction<String, JSONObject, Object> run = (c, extra) -> {
            try { JSONObject o = new JSONObject().put("biblioteca", bib); for (String k : extra.keySet()) o.put(k, extra.get(k)); return m.executar(c, o); }
            catch (Exception e) { return "ERRO:" + e.getMessage(); }
        };
        confere(((JSONArray) run.apply("pastas", new JSONObject())).length() == 0, "biblioteca começa sem pastas");
        confere(String.valueOf(run.apply("adicionar_pasta", new JSONObject().put("pasta", "/nao/existe"))).startsWith("ERRO"), "pasta inexistente é recusada");
        run.apply("adicionar_pasta", new JSONObject().put("pasta", new File(t, "roms").getPath()));
        JSONObject r = (JSONObject) run.apply("escanear", new JSONObject());
        confere(r.getInt("novos") == 4, "acha 4 jogos (achou " + r.getInt("novos") + ")");
        JSONArray lista = (JSONArray) run.apply("listar", new JSONObject().put("filtro", new JSONObject().put("texto", "zelda")));
        confere(lista.length() == 1 && lista.getJSONObject(0).getString("titulo").equals("The Legend of Zelda - A Link to the Past"), "título limpo e artigo na frente");
        confere(lista.getJSONObject(0).getString("plataforma").equals("snes"), "plataforma pela pasta");
        JSONArray gba = (JSONArray) run.apply("listar", new JSONObject().put("filtro", new JSONObject().put("plataforma", "gba")));
        confere(gba.length() == 1, "plataforma pela extensão única (gba)");
        String id = lista.getJSONObject(0).getString("id");
        run.apply("favoritar", new JSONObject().put("id", id));
        confere(((JSONObject) run.apply("jogo", new JSONObject().put("id", id))).getBoolean("favorito"), "favoritar");
        run.apply("sessao_iniciar", new JSONObject().put("id", id).put("agora", 2000));
        JSONObject fim = (JSONObject) run.apply("sessao_encerrar", new JSONObject().put("id", id).put("agora", 2300));
        confere(fim.getLong("duracao_s") == 300, "sessão de 300 s");
        confere(((JSONObject) run.apply("estatisticas", new JSONObject())).getLong("tempo_total_s") == 300, "estatística soma o tempo");
        confere(((JSONArray) run.apply("continuar", new JSONObject())).length() == 1, "continuar jogando");
        confere(((JSONArray) run.apply("plataformas", new JSONObject())).length() == 3, "3 plataformas");
        new File(t, "roms/psx/Crash Bandicoot.cue").delete();
        JSONObject r2 = (JSONObject) run.apply("escanear", new JSONObject());
        confere(r2.getInt("removidos") == 1, "jogo apagado sai da biblioteca");
        JSONObject cfg = (JSONObject) run.apply("modo_jogo_config", new JSONObject());
        confere(cfg.getBoolean("ligado"), "modo jogo padrão ligado");
        confere(Motor.titulo("Sonic_the_Hedgehog_2_(World).md").equals("Sonic the Hedgehog 2"), "título de nome com sublinhado");
        confere(Motor.caminhoDaArvore("primary:Roms/SNES").equals("/storage/emulated/0/Roms/SNES"), "pasta do armazenamento interno");
        confere(Motor.caminhoDaArvore("1A2B-3C4D:Jogos").equals("/storage/1A2B-3C4D/Jogos"), "pasta do cartão");
        System.out.println(falhas == 0 ? "TUDO CERTO" : falhas + " FALHAS");
        System.exit(falhas == 0 ? 0 : 1);
    }
}

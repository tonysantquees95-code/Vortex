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
        // organizador automático
        File solto = new File(t, "Download");
        solto.mkdirs();
        Files.write(new File(solto, "Sonic (USA).md").toPath(), "x".getBytes());
        try (java.util.zip.ZipOutputStream z = new java.util.zip.ZipOutputStream(new java.io.FileOutputStream(new File(solto, "Contra.zip")))) {
            z.putNextEntry(new java.util.zip.ZipEntry("Contra (USA).nes")); z.write("b".getBytes()); z.closeEntry();
        }
        try (java.util.zip.ZipOutputStream z = new java.util.zip.ZipOutputStream(new java.io.FileOutputStream(new File(solto, "mau.zip")))) {
            z.putNextEntry(new java.util.zip.ZipEntry("../fora.nes")); z.write("b".getBytes()); z.closeEntry();
            z.putNextEntry(new java.util.zip.ZipEntry("ok.nes")); z.write("b".getBytes()); z.closeEntry();
        }
        new File(solto, "psx").mkdirs();
        Files.write(new File(solto, "psx/Crash.cue").toPath(), "FILE \"Crash.bin\" BINARY\n".getBytes());
        Files.write(new File(solto, "psx/Crash.bin").toPath(), "e".getBytes());
        File vortex = new File(t, "Vortex/Jogos");
        JSONObject sim = (JSONObject) run.apply("organizar", new JSONObject().put("origens", new JSONArray().put(solto.getPath())).put("pasta_vortex", vortex.getPath()).put("simulacao", true));
        confere(sim.getJSONArray("organizados").length() == 4, "simulação acha 4 jogos (achou " + sim.getJSONArray("organizados").length() + ")");
        confere(new File(solto, "Sonic (USA).md").exists(), "simulação não mexe em nada");
        JSONObject org = (JSONObject) run.apply("organizar", new JSONObject().put("origens", new JSONArray().put(solto.getPath())).put("pasta_vortex", vortex.getPath()));
        confere(org.getJSONArray("organizados").length() == 4 && org.getJSONArray("falhas").length() == 0, "organizou 4 sem falhas");
        confere(!new File(solto, "Sonic (USA).md").exists() && new File(vortex, "Mega Drive / Genesis".replace("/", "-")).isDirectory(), "jogo foi para a pasta do console");
        confere(!new File(t, "fora.nes").exists() && !new File(vortex, "fora.nes").exists(), "zip malicioso não escapa");
        confere(new File(vortex, "Vortex").exists() == false, "sem pasta estranha");
        JSONArray ps = (JSONArray) run.apply("pastas", new JSONObject());
        boolean tem = false;
        for (int i = 0; i < ps.length(); i++) if (ps.getString(i).equals(vortex.getPath())) tem = true;
        confere(tem, "pasta do Vortex entrou na biblioteca");
        JSONObject d = (JSONObject) run.apply("organizar_desfazer", new JSONObject());
        confere(d.getInt("devolvidos") == 3 && new File(solto, "psx/Crash.bin").exists() && new File(solto, "Sonic (USA).md").exists(), "desfazer devolve os arquivos soltos (" + d.getInt("devolvidos") + ")");
        // loja: baixa (servidor falso), confere a assinatura, organiza e marca como instalado
        File falsoZip = new File(t, "falso.zip");
        try (java.util.zip.ZipOutputStream z = new java.util.zip.ZipOutputStream(new java.io.FileOutputStream(falsoZip))) {
            z.putNextEntry(new java.util.zip.ZipEntry("Jogo.nes")); z.write("x".getBytes()); z.closeEntry();
        }
        String sha = Motor.sha256(falsoZip);
        String catalogo = new JSONObject().put("jogos", new JSONArray().put(new JSONObject().put("id", "j1").put("titulo", "Jogo").put("plataforma", "nes").put("url", "https://raw.githubusercontent.com/x/Jogo.zip").put("sha256", sha))).toString();
        Motor lojaMotor = new Motor(() -> 9, (u, dest) -> Files.copy(falsoZip.toPath(), dest.toPath()));
        File vortex2 = new File(t, "V2/Jogos");
        JSONObject args2 = new JSONObject().put("biblioteca", new File(t, "loja/biblioteca.json").getPath()).put("catalogo_json", catalogo).put("pasta_vortex", vortex2.getPath()).put("id", "j1");
        JSONArray cat0 = (JSONArray) lojaMotor.executar("loja_catalogo", args2);
        confere(cat0.length() == 1 && !cat0.getJSONObject(0).getBoolean("instalado"), "loja: começa sem nada instalado");
        JSONObject inst = (JSONObject) lojaMotor.executar("loja_instalar", args2);
        confere(inst.getBoolean("instalado") && !inst.isNull("jogo_id"), "loja: instalou e achou o jogo na biblioteca");
        confere(((JSONArray) lojaMotor.executar("loja_catalogo", args2)).getJSONObject(0).getBoolean("instalado"), "loja: aparece como instalado");
        Motor ruim = new Motor(() -> 9, (u, dest) -> Files.write(dest.toPath(), "lixo".getBytes()));
        String erro = "";
        try { ruim.executar("loja_instalar", args2.put("id", "j1").put("pasta_vortex", new File(t, "V3").getPath())); } catch (Exception e) { erro = e.getMessage(); }
        confere(erro.contains("não confere") && !new File(t, "V3").exists(), "loja: arquivo adulterado é recusado");
        confere(!Motor.hospedeiroPermitido("https://romsgames.net/x") && Motor.hospedeiroPermitido("https://raw.githubusercontent.com/a/b"), "loja: só baixa de servidor permitido");
        // perfis de controle
        File arqPerfis = new File(t, "perfis/perfis.json");
        confere(Perfis.modelos().length() >= 3, "perfis: há modelos prontos");
        JSONObject np = Perfis.novo("com.exemplo.jogo", "", "tiro", 5);
        confere(np.getString("nome").startsWith("Tiro") && np.getJSONArray("botoes").length() > 5, "perfis: perfil novo copia o modelo");
        Perfis.guardarPerfil(arqPerfis, np);
        JSONObject todos = Perfis.carregar(arqPerfis);
        confere(Perfis.ativoDe(todos, "com.exemplo.jogo") != null, "perfis: o primeiro perfil do jogo vira o ativo");
        double[] alvo = Perfis.alvoDaTecla(Perfis.ativoDe(todos, "com.exemplo.jogo"), 105); // R2
        confere(alvo != null && alvo[0] > 0.8, "perfis: R2 toca onde o modelo manda");
        double[] cima = Perfis.alvoDaTecla(Perfis.ativoDe(todos, "com.exemplo.jogo"), 19);
        confere(cima != null && cima[1] < 0.70, "perfis: direcional para cima toca acima do centro");
        confere(Perfis.alvoDaTecla(Perfis.ativoDe(todos, "com.exemplo.jogo"), 4) == null, "perfis: tecla desconhecida não faz nada");
        JSONObject sujo = new JSONObject(np.toString());
        sujo.getJSONArray("botoes").put(new JSONObject().put("tecla", "HACK").put("x", 9).put("y", -3));
        sujo.getJSONArray("botoes").put(new JSONObject().put("tecla", "A").put("x", 5).put("y", -1));
        JSONObject limpo = Perfis.limpar(sujo);
        boolean temHack = false; double ax = -1;
        for (int i = 0; i < limpo.getJSONArray("botoes").length(); i++) { JSONObject b = limpo.getJSONArray("botoes").getJSONObject(i); if (b.getString("tecla").equals("HACK")) temHack = true; if (b.getString("tecla").equals("A")) ax = b.getDouble("x"); }
        confere(!temHack && ax <= 1.0, "perfis: tecla estranha sai e posição fica dentro da tela");
        boolean recusou = false;
        try { Perfis.limpar(new JSONObject().put("id", "x").put("pacote", "../../etc")); } catch (Exception e) { recusou = true; }
        confere(recusou, "perfis: pacote com caminho estranho é recusado");
        Perfis.guardarPerfil(arqPerfis, Perfis.novo("com.exemplo.jogo", "Meu layout", "acao", 6));
        String segundo = Perfis.carregar(arqPerfis).getJSONArray("perfis").getJSONObject(1).getString("id");
        Perfis.ativar(arqPerfis, "com.exemplo.jogo", segundo);
        confere(Perfis.ativoDe(Perfis.carregar(arqPerfis), "com.exemplo.jogo").getString("nome").equals("Meu layout"), "perfis: trocar o perfil ativo");
        Perfis.apagarPerfil(arqPerfis, segundo);
        confere(Perfis.ativoDe(Perfis.carregar(arqPerfis), "com.exemplo.jogo") != null && Perfis.carregar(arqPerfis).getJSONArray("perfis").length() == 1, "perfis: apagar o ativo passa para outro");
        System.out.println(falhas == 0 ? "TUDO CERTO" : falhas + " FALHAS");
        System.exit(falhas == 0 ? 0 : 1);
    }
}

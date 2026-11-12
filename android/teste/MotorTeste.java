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
        confere(Motor.titulo("SuperMarioWorld.sfc").equals("Super Mario World"), "título de nome colado");
        confere(Motor.titulo("0123 - Metroid Fusion (USA).gba").equals("Metroid Fusion"), "tira número de catálogo");
        confere(Motor.titulo("www.romsite.com - Tetris (World).gb").equals("Tetris"), "tira endereço de site");
        confere(Motor.titulo("Pac-Man - Copy.nes").equals("Pac-Man"), "tira sufixo de cópia");
        confere(Motor.titulo("007 - Nightfire (USA).iso").equals("007 - Nightfire"), "007 continua 007");
        {
            File lr = new File(t, "limpa/nes");
            lr.mkdirs();
            byte[] nes = new byte[40000]; nes[0] = 'N'; nes[1] = 'E'; nes[2] = 'S'; nes[3] = 0x1A; nes[100] = 1;
            byte[] nes2 = nes.clone(); nes2[100] = 2;
            Files.write(new File(lr, "Contra (USA).nes").toPath(), nes);
            Files.write(new File(lr, "Contra (Japan).nes").toPath(), nes2);
            Files.write(new File(lr, "Contra (USA) copia.nes").toPath(), nes);
            Files.write(new File(lr, "Quebrado.nes").toPath(), "isto nao e um jogo de verdade".getBytes());
            Files.write(new File(lr, "Vazio.nes").toPath(), new byte[0]);
            byte[] nes3 = nes.clone(); nes3[100] = 3;
            Files.write(new File(lr, "Mario (USA).nes").toPath(), nes3);
            String bib2 = new File(t, "dados/limpa.json").getPath();
            m.executar("adicionar_pasta", new JSONObject().put("biblioteca", bib2).put("pasta", new File(t, "limpa").getPath()));
            m.executar("escanear", new JSONObject().put("biblioteca", bib2));
            JSONObject sim = (JSONObject) m.executar("limpar", new JSONObject().put("biblioteca", bib2).put("simulacao", true));
            confere(sim.getJSONArray("corrompidos").length() == 2 && sim.getJSONArray("duplicados").length() == 2 && new File(lr, "Quebrado.nes").exists(), "simulação conta e não mexe (" + sim + ")");
            JSONObject rl = (JSONObject) m.executar("limpar", new JSONObject().put("biblioteca", bib2));
            confere(rl.getJSONArray("falhas").length() == 0, "limpar sem falhas " + rl);
            confere(new File(t, "limpa/Corrompidos/Quebrado.nes").isFile() && new File(t, "limpa/Corrompidos/Vazio.nes").isFile(), "corrompidos vão para a pasta Corrompidos");
            confere(new File(t, "limpa/Duplicados").isDirectory() && new File(lr, "Contra (USA).nes").isFile() && new File(lr, "Mario (USA).nes").isFile(), "fica a versão preferida e os outros jogos");
            // download incompleto: NSP que promete mais bytes do que tem; e pedaço "00" não vira jogo
            File sw = new File(t, "fora/switch"); sw.mkdirs();
            byte[] nsp = new byte[1024];
            nsp[0] = 'P'; nsp[1] = 'F'; nsp[2] = 'S'; nsp[3] = '0'; nsp[4] = 1; nsp[8] = 8; // 1 arquivo, tabela de nomes com 8 bytes
            nsp[16 + 8] = (byte) (5000 & 0xff); nsp[16 + 9] = (byte) (5000 >> 8); // promete 5000 bytes, o arquivo tem 1024
            Files.write(new File(sw, "Jogo Cortado.nsp").toPath(), nsp);
            Files.write(new File(sw, "00.nsp").toPath(), nsp);
            confere(Limpeza.motivo(new File(sw, "Jogo Cortado.nsp")) != null && Limpeza.motivo(new File(sw, "Jogo Cortado.nsp")).startsWith("download incompleto"), "NSP cortado é pego (" + Limpeza.motivo(new File(sw, "Jogo Cortado.nsp")) + ")");
            JSONObject r3 = (JSONObject) m.executar("escanear", new JSONObject().put("biblioteca", bib2));
            confere(r3.getInt("encontrados") == 2, "depois da limpeza a biblioteca tem 2 jogos (achou " + r3.getInt("encontrados") + ")");
        }
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
        // ---- nuvem: mesma chave do Rust e mesma regra de versões
        confere(Nuvem.chaveDoJogo("nes", "Super Mario Bros. (USA).nes").equals("nes-super-mario-bros-usa-nes"), "nuvem: chave do jogo igual à do Windows");
        confere(Nuvem.chaveDoJogo("snes", "  Zelda!!  ").equals("snes-zelda") && Nuvem.chaveDoJogo("gba", "a".repeat(200)).length() <= 60, "nuvem: chave limpa e curta");
        final java.util.Map<String, Object[]> servidor = new java.util.HashMap<String, Object[]>();
        Nuvem.Rede falsa = (metodo, caminho, token, corpo, base) -> {
            if (caminho.equals("/id/entrar")) return new Nuvem.Resposta(200, "{\"token\":\"jwt\"}".getBytes(), -1);
            if (caminho.equals("/vortex/licenca")) return new Nuvem.Resposta(200, "{\"vortex\":true}".getBytes(), -1);
            if (caminho.equals("/vortex/saves")) {
                JSONArray l = new JSONArray();
                for (java.util.Map.Entry<String, Object[]> e : servidor.entrySet()) { String[] p = e.getKey().split("/"); l.put(new JSONObject().put("jogo", p[0]).put("arquivo", p[1]).put("versao", (Long) e.getValue()[0])); }
                return new Nuvem.Resposta(200, new JSONObject().put("saves", l).toString().getBytes(), -1);
            }
            String k = caminho.substring("/vortex/saves/".length());
            Object[] atual = servidor.get(k);
            if (metodo.equals("GET")) return atual == null ? new Nuvem.Resposta(404, "{}".getBytes(), -1) : new Nuvem.Resposta(200, (byte[]) atual[1], (Long) atual[0]);
            long v = atual == null ? 0 : (Long) atual[0];
            if (atual != null && base != v) return new Nuvem.Resposta(409, "{}".getBytes(), -1);
            servidor.put(k, new Object[]{v + 1, corpo});
            return new Nuvem.Resposta(200, ("{\"versao\":" + (v + 1) + "}").getBytes(), -1);
        };
        File dA = new File(t, "nuvemA"), dB = new File(t, "nuvemB");
        File sA = new File(dA, "saves/a.srm"), sB = new File(dB, "saves/b.srm");
        sA.getParentFile().mkdirs();
        Nuvem.entrar(falsa, dA, " A@B.C ", "senha", "Celular A");
        Nuvem.entrar(falsa, dB, "a@b.c", "senha", "Celular B");
        confere(Nuvem.estado(falsa, dA).getBoolean("vortex") && !Nuvem.estado(falsa, new File(t, "ninguem")).getBoolean("logado"), "nuvem: estado da conta");
        Files.write(sA.toPath(), "save 1".getBytes());
        java.util.List<Nuvem.Item> iA = java.util.Arrays.asList(new Nuvem.Item("nes-zelda", "jogo.srm", sA));
        java.util.List<Nuvem.Item> iB = java.util.Arrays.asList(new Nuvem.Item("nes-zelda", "jogo.srm", sB));
        confere(Nuvem.sincronizar(falsa, dA, iA, "perguntar").getInt("enviados") == 1, "nuvem: A envia o save");
        confere(Nuvem.sincronizar(falsa, dB, iB, "perguntar").getInt("baixados") == 1 && new String(Files.readAllBytes(sB.toPath())).equals("save 1"), "nuvem: B baixa o save de A");
        Files.write(sA.toPath(), "do A".getBytes());
        Files.write(sB.toPath(), "do B".getBytes());
        confere(Nuvem.sincronizar(falsa, dA, iA, "perguntar").getInt("enviados") == 1, "nuvem: A envia a mudança");
        JSONObject rc = Nuvem.sincronizar(falsa, dB, iB, "perguntar");
        confere(rc.getJSONArray("conflitos").length() == 1 && new String(Files.readAllBytes(sB.toPath())).equals("do B"), "nuvem: mudou nos dois lados vira conflito e nada se perde");
        confere(Nuvem.sincronizar(falsa, dB, iB, "nuvem").getInt("baixados") == 1 && new String(Files.readAllBytes(sB.toPath())).equals("do A")
                && new String(Files.readAllBytes(new File(sB.getPath() + ".antes-da-nuvem").toPath())).equals("do B"), "nuvem: escolher a nuvem guarda o save local ao lado");
        Nuvem.Rede ponte = (metodo, caminho, token, corpo, base) -> caminho.startsWith("/vortex/fila?plataforma=android")
                ? new Nuvem.Resposta(200, "{\"pedidos\":[{\"id\":\"aaaaaaaaaaaaaaaaaaaaaaaa\",\"comando\":\"abrir_jogo\",\"argumento\":\"Zelda\"}]}".getBytes(), -1)
                : new Nuvem.Resposta(200, "{}".getBytes(), -1);
        confere(Nuvem.fila(ponte, dA).getJSONArray("pedidos").getJSONObject(0).getString("argumento").equals("Zelda"), "ponte: busca o pedido da Vênus");
        Nuvem.responder(ponte, dA, "aaaaaaaaaaaaaaaaaaaaaaaa", true, "Abri Zelda.");
        boolean recusouId = false; try { Nuvem.responder(ponte, dA, "../x", true, ""); } catch (Exception e) { recusouId = true; }
        confere(recusouId, "ponte: id estranho é recusado");
        Nuvem.sair(falsa, dB);
        confere(!Nuvem.estado(falsa, dB).getBoolean("logado"), "nuvem: sair apaga o login");
        // busca de jogos no armazenamento: acha pastas de ROMs mesmo em lugares e nomes variados, sem entrar nas pastas de apps
        File card = new File(t, "cartao");
        new File(card, "Games/Retro/SNES").mkdirs();
        new File(card, "Emuladores/ROMs").mkdirs();
        new File(card, "Super Nintendo").mkdirs();
        new File(card, "Android/data/app/roms").mkdirs();
        new File(card, "Fotos/ferias").mkdirs();
        java.util.List<File> cands = Organizador.candidatos(java.util.Arrays.asList(card.getPath()));
        java.util.List<String> nomes = new java.util.ArrayList<String>();
        for (File f : cands) nomes.add(card.toURI().relativize(f.toURI()).getPath());
        confere(nomes.contains("Games/") && !nomes.contains("Games/Retro/") && !nomes.contains("Games/Retro/SNES/"), "acha a pasta Games sem repetir as de dentro (" + nomes + ")");
        confere(nomes.contains("Emuladores/ROMs/") || nomes.contains("Emuladores/"), "acha a pasta de emuladores (" + nomes + ")");
        confere(nomes.contains("Super Nintendo/"), "acha pasta com nome de console (" + nomes + ")");
        confere(!nomes.toString().contains("Android") && !nomes.toString().contains("Fotos"), "ignora Android/data e pastas sem relação (" + nomes + ")");
        System.out.println(falhas == 0 ? "TUDO CERTO" : falhas + " FALHAS");
        System.exit(falhas == 0 ? 0 : 1);
    }
}

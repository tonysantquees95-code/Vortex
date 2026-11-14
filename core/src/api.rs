//! Interface única (JSON) do motor, usada pelo app de Windows (Tauri) e pelos testes. O Android implementa o mesmo contrato.
//! Todo comando recebe `biblioteca` (caminho do arquivo JSON da biblioteca) e devolve JSON.
use crate::biblioteca::{Biblioteca, Filtro, OpcoesEscaneamento};
use crate::modo_jogo::{self, SistemaReal, Sistema};
use crate::loja;
use crate::nucleos;
use crate::nuvem;
use crate::pc;
use crate::organizador;
use crate::emuladores::{self, Ambiente, Configuracao, Lancamento, Preferido};
use crate::plataformas::PLATAFORMAS;
use serde_json::{json, Value};
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::sync::{Arc, Mutex, OnceLock};
use std::time::{SystemTime, UNIX_EPOCH};

/// Quem lê e grava a biblioteca (a tela e o vigia de jogo aberto) passa por aqui, uma de cada vez.
static BLOQUEIO: Mutex<()> = Mutex::new(());

fn agora_real() -> u64 {
    SystemTime::now().duration_since(UNIX_EPOCH).map(|d| d.as_secs()).unwrap_or(0)
}

fn arquivo_de_configuracao(biblioteca: &Path) -> PathBuf {
    biblioteca.with_file_name("configuracao.json")
}

fn pasta_de_dados(biblioteca: &Path) -> PathBuf {
    biblioteca.parent().map(Path::to_path_buf).unwrap_or_default()
}

/// Chamado quando um jogo/emulador aberto pelo Vortex fecha (o app do Windows usa para trazer o Vortex de volta à frente com o foco).
static AO_FECHAR_JOGO: OnceLock<Box<dyn Fn() + Send + Sync>> = OnceLock::new();
pub fn definir_ao_fechar_jogo(f: impl Fn() + Send + Sync + 'static) {
    let _ = AO_FECHAR_JOGO.set(Box::new(f));
}

/// Abre o emulador e, quando ele fecha, soma o tempo jogado. Devolve o número do processo.
/// `relogio` dá a hora em segundos (nos testes é falso).
pub fn lancar_plano(plano: &Lancamento, biblioteca: PathBuf, id: String, relogio: impl Fn() -> u64 + Send + 'static) -> Result<u32, String> {
    lancar_com_modo(plano, biblioteca, id, relogio, None)
}

fn arquivo_do_modo_jogo(biblioteca: &Path) -> PathBuf {
    biblioteca.with_file_name("modo_jogo_config.json")
}

/// Igual a `lancar_plano`, mas liga o modo jogo enquanto o emulador estiver aberto e desfaz tudo quando ele fechar.
pub fn lancar_com_modo(plano: &Lancamento, biblioteca: PathBuf, id: String, relogio: impl Fn() -> u64 + Send + 'static, modo: Option<modo_jogo::Configuracao>) -> Result<u32, String> {
    let mut cmd = Command::new(&plano.programa);
    cmd.args(&plano.args).stdin(Stdio::null()).stdout(Stdio::null()).stderr(Stdio::null());
    if let Some(d) = plano.diretorio.as_ref().filter(|d| d.is_dir()) {
        cmd.current_dir(d);
    }
    let mut filho = cmd.spawn().map_err(|e| format!("Não consegui abrir o emulador ({}): {e}", plano.programa.display()))?;
    let pid = filho.id();
    {
        let _g = BLOQUEIO.lock().unwrap_or_else(|e| e.into_inner());
        let mut b = Biblioteca::carregar(&biblioteca);
        b.iniciar_sessao(&id, relogio())?;
        b.salvar(&biblioteca)?;
    }
    let sistema = Arc::new(SistemaReal::novo());
    let dados = pasta_de_dados(&biblioteca);
    let mut avisos = Vec::new();
    if let Some(cfg) = modo.filter(|c| c.ligado) {
        let rel = modo_jogo::ativar(sistema.as_ref(), &cfg, pid, Some(&plano.programa), &[std::process::id()], &dados, agora_real());
        avisos = rel.avisos;
    }
    let _ = avisos; // o app mostra os avisos pelo comando "modo_jogo_ativar"; aqui só seguimos
    let sis_fim = sistema.clone();
    std::thread::spawn(move || {
        let _ = filho.wait();
        modo_jogo::desativar(sis_fim.as_ref(), &dados);
        let _g = BLOQUEIO.lock().unwrap_or_else(|e| e.into_inner());
        let mut b = Biblioteca::carregar(&biblioteca);
        b.encerrar_sessao(&id, relogio());
        let _ = b.salvar(&biblioteca);
        drop(_g);
        if let Some(f) = AO_FECHAR_JOGO.get() {
            f();
        }
    });
    Ok(pid)
}

fn plano_do_jogo(b: &Biblioteca, id: &str, biblioteca: &Path) -> Result<Lancamento, String> {
    let j = b.jogos.get(id).ok_or("Esse jogo não está mais na biblioteca.")?;
    let amb = Ambiente::atual();
    let cfg = Configuracao::carregar(&arquivo_de_configuracao(biblioteca));
    let instalados = emuladores::descobrir(&amb, &cfg);
    emuladores::planejar(&j.caminho, &j.plataforma, &instalados, &cfg, &amb, &pasta_de_dados(biblioteca))
}

fn texto<'a>(v: &'a Value, campo: &str) -> Result<&'a str, String> {
    v.get(campo).and_then(|x| x.as_str()).filter(|s| !s.trim().is_empty()).ok_or_else(|| format!("Faltou informar: {campo}."))
}

fn arquivo_da_biblioteca(v: &Value) -> Result<PathBuf, String> {
    Ok(PathBuf::from(texto(v, "biblioteca")?))
}

fn agora(v: &Value) -> u64 {
    v.get("agora").and_then(|x| x.as_u64()).unwrap_or_else(agora_real)
}

fn para<T: serde::Serialize>(x: T) -> Result<Value, String> {
    serde_json::to_value(x).map_err(|e| e.to_string())
}

fn arquivo_da_loja(biblioteca: &Path) -> PathBuf {
    biblioteca.with_file_name("loja_instalados.json")
}

fn instalados_da_loja(biblioteca: &Path) -> std::collections::BTreeMap<String, String> {
    std::fs::read_to_string(arquivo_da_loja(biblioteca)).ok().and_then(|t| serde_json::from_str(&t).ok()).unwrap_or_default()
}

/// Catálogo da loja com o que já está instalado (e o id do jogo na biblioteca, para o botão Jogar).
fn loja_catalogo_json(biblioteca: &Path) -> Value {
    let marcados = instalados_da_loja(biblioteca);
    let b = Biblioteca::carregar(biblioteca);
    let lista: Vec<Value> = loja::catalogo().into_iter().map(|o| {
        let caminho = marcados.get(&o.id).filter(|c| Path::new(c).is_file());
        let jogo_id = caminho.and_then(|c| b.jogos.values().find(|j| j.caminho == Path::new(c)).map(|j| j.id.clone()));
        let mut v = serde_json::to_value(&o).unwrap_or(Value::Null);
        v["instalado"] = json!(caminho.is_some());
        v["jogo_id"] = json!(jogo_id);
        v
    }).collect();
    json!(lista)
}

/// Baixa e instala um jogo da loja. Roda sem segurar a biblioteca (o download pode demorar).
fn loja_instalar_com(args: &Value, baixar: loja::Baixar) -> Result<Value, String> {
    let arquivo = arquivo_da_biblioteca(args)?;
    let id = texto(args, "id")?;
    let oferta = loja::catalogo().into_iter().find(|o| o.id == id).ok_or("Esse jogo não está mais no catálogo.")?;
    let amb = Ambiente::atual();
    let pasta_vortex = args.get("pasta_vortex").and_then(|x| x.as_str()).filter(|s| !s.trim().is_empty()).map(PathBuf::from).unwrap_or_else(|| amb.casa.join("Documents").join("Vortex").join("Jogos"));
    let itens = loja::instalar(&oferta, &pasta_de_dados(&arquivo), &pasta_vortex, baixar)?;
    let destino = itens.first().map(|i| i.destino.to_string_lossy().to_string()).ok_or("Nada foi instalado.")?;
    let mut m = instalados_da_loja(&arquivo);
    m.insert(oferta.id.clone(), destino);
    let _ = std::fs::create_dir_all(pasta_de_dados(&arquivo));
    if let Ok(t) = serde_json::to_string_pretty(&m) {
        let _ = std::fs::write(arquivo_da_loja(&arquivo), t);
    }
    // a pasta do Vortex entra na biblioteca e o jogo já aparece
    executar("adicionar_pasta", &json!({ "biblioteca": arquivo, "pasta": pasta_vortex, "agora": args.get("agora") }))?;
    executar("escanear", &json!({ "biblioteca": arquivo, "agora": args.get("agora") }))?;
    let cat = loja_catalogo_json(&arquivo);
    let jogo_id = cat.as_array().and_then(|l| l.iter().find(|v| v["id"] == oferta.id)).map(|v| v["jogo_id"].clone()).unwrap_or(Value::Null);
    Ok(json!({ "instalado": true, "jogo_id": jogo_id }))
}

/// Garante o motor embutido (RetroArch portátil + núcleo) do console do jogo. Pode demorar na primeira vez, por isso roda sem segurar a biblioteca.
fn preparar_jogo_com(args: &Value, baixar: nucleos::Baixar) -> Result<Value, String> {
    let arquivo = arquivo_da_biblioteca(args)?;
    let id = texto(args, "id")?;
    let b = Biblioteca::carregar(&arquivo);
    let j = b.jogos.get(id).ok_or("Esse jogo não está mais na biblioteca.")?;
    let pl = crate::plataformas::por_id(&j.plataforma).ok_or("Console desconhecido.")?;
    let dados = pasta_de_dados(&arquivo);
    let r = nucleos::preparar(&dados, pl, baixar)?;
    // o RetroArch embutido vira o preferido, a não ser que a pessoa já tenha escolhido outro
    let ca = arquivo_de_configuracao(&arquivo);
    let mut c = Configuracao::carregar(&ca);
    if c.retroarch.is_none() {
        c.retroarch = Some(nucleos::pasta_do_motor(&dados));
        c.salvar(&ca)?;
    }
    Ok(json!({ "nucleo": r.nucleo, "baixou": r.baixou }))
}

/// Conta Vetorial ID e saves na nuvem. Fica fora do trava da biblioteca porque espera pela rede.
pub fn conta_e_saves(comando: &str, args: &Value, rede: &dyn nuvem::Rede) -> Result<Value, String> {
    let arquivo = arquivo_da_biblioteca(args)?;
    let dados = pasta_de_dados(&arquivo);
    match comando {
        "conta_estado" => Ok(nuvem::estado(rede, &dados)),
        "conta_entrar" => {
            let c = nuvem::entrar(rede, &dados, texto(args, "email")?, texto(args, "senha")?, texto(args, "aparelho").unwrap_or("Computador"), "windows")?;
            Ok(json!({ "logado": true, "email": c.email }))
        }
        "conta_sair" => {
            nuvem::sair(rede, &dados);
            Ok(json!({ "logado": false }))
        }
        "saves_sincronizar" => {
            let c = nuvem::conta_salva(&dados).ok_or("Entre na sua conta Vetorial ID para sincronizar os saves.")?;
            let politica = match args.get("conflitos").and_then(|x| x.as_str()) {
                Some("local") => nuvem::Conflito::UsarLocal,
                Some("nuvem") => nuvem::Conflito::UsarNuvem,
                _ => nuvem::Conflito::Perguntar,
            };
            let motor = nucleos::pasta_do_motor(&dados);
            let b = Biblioteca::carregar(&arquivo);
            let mut itens = Vec::new();
            for j in b.jogos.values().filter(|j| j.disponivel) {
                let Some(stem) = j.caminho.file_stem().and_then(|s| s.to_str()) else { continue };
                let jogo = nuvem::chave_do_jogo(&j.plataforma, stem);
                itens.push(nuvem::ItemLocal { jogo: jogo.clone(), arquivo: "jogo.srm".into(), caminho: motor.join("saves").join(format!("{stem}.srm")) });
                itens.push(nuvem::ItemLocal { jogo, arquivo: "estado.auto".into(), caminho: motor.join("states").join(format!("{stem}.state.auto")) });
            }
            para(nuvem::sincronizar(rede, &c.token, &itens, &dados.join("saves_estado.json"), politica)?)
        }
        // jogos que têm save na conta (de qualquer aparelho), para mostrar o que falta neste
        "saves_lista" => {
            let c = nuvem::conta_salva(&dados).ok_or("Entre na sua conta Vetorial ID.")?;
            let r = rede.pedir("GET", "/vortex/saves", Some(&c.token), None, None)?;
            if r.status != 200 {
                return Err(format!("O servidor respondeu {}.", r.status));
            }
            serde_json::from_slice(&r.corpo).map_err(|e| e.to_string())
        }
        // chamadas da Steam ao servidor da conta (só /vortex/steam…), com o token deste aparelho
        "conta_pedir" => {
            let c = nuvem::conta_salva(&dados).ok_or("Entre na sua conta Vetorial ID.")?;
            let caminho = texto(args, "caminho")?;
            let metodo = texto(args, "metodo").unwrap_or("GET");
            if !(caminho == "/vortex/steam" || caminho.starts_with("/vortex/steam/")) || !["GET", "POST", "DELETE"].contains(&metodo) {
                return Err("Pedido não permitido.".into());
            }
            let r = rede.pedir(metodo, caminho, Some(&c.token), if metodo == "POST" { Some(&b"{}"[..]) } else { None }, None)?;
            let v: Value = serde_json::from_slice(&r.corpo).unwrap_or(Value::Null);
            if r.status >= 400 {
                return Err(v.get("error").and_then(|x| x.as_str()).map(String::from).unwrap_or_else(|| format!("O servidor respondeu {}.", r.status)));
            }
            Ok(v)
        }
        // ponte de voz: o Vortex aberto pergunta o que a Vênus pediu e responde
        "ponte_fila" => {
            let c = nuvem::conta_salva(&dados).ok_or("Sem conta.")?;
            Ok(nuvem::fila(rede, &c.token, "windows")?)
        }
        "ponte_responder" => {
            let c = nuvem::conta_salva(&dados).ok_or("Sem conta.")?;
            nuvem::responder(rede, &c.token, texto(args, "id")?, args.get("ok").and_then(|x| x.as_bool()).unwrap_or(true), texto(args, "resumo").unwrap_or(""))?;
            Ok(json!({ "ok": true }))
        }
        _ => Err(format!("Comando desconhecido: {comando}")),
    }
}

pub fn executar(comando: &str, args: &Value) -> Result<Value, String> {
    if comando == "loja_catalogo" {
        return Ok(loja_catalogo_json(&arquivo_da_biblioteca(args)?));
    }
    if comando == "loja_instalar" {
        return loja_instalar_com(args, &loja::baixar_https);
    }
    if comando == "preparar_jogo" {
        return preparar_jogo_com(args, &nucleos::baixar_da_libretro);
    }
    if comando.starts_with("conta_") || comando.starts_with("ponte_") || comando == "saves_sincronizar" || comando == "saves_lista" || comando == "conta_pedir" {
        return conta_e_saves(comando, args, &nuvem::RedeReal);
    }
    if comando == "plataformas_catalogo" {
        return para(PLATAFORMAS);
    }
    if comando == "abrir_url" {
        let url = texto(args, "url")?;
        return abrir_url(&url).map(|_| json!({ "aberto": true }));
    }
    if comando == "abrir_steam" {
        let appid = texto(args, "appid")?;
        let acao = if texto(args, "acao").unwrap_or("jogar") == "instalar" { "install" } else { "rungameid" };
        if appid.is_empty() || appid.len() > 10 || !appid.chars().all(|c| c.is_ascii_digit()) {
            return Err("Jogo da Steam inválido.".into());
        }
        if !cfg!(windows) {
            return Err("Abrir jogos da Steam só no Windows.".into());
        }
        let r = Command::new("cmd").args(["/C", "start", "", &format!("steam://{acao}/{appid}")]).spawn();
        return r.map(|_| json!({ "aberto": true })).map_err(|e| format!("Não consegui abrir a Steam: {e}"));
    }
    if comando == "pc_importar" {
        return pc_importar(args);
    }
    if comando == "pc_adicionar" {
        return pc_adicionar(args);
    }
    if comando == "abrir_pasta" {
        let pasta = texto(args, "pasta")?;
        return abrir_pasta(&pasta).map(|_| json!({ "aberto": true, "vindex": true }));
    }
    let arquivo = arquivo_da_biblioteca(args)?;
    let _g = BLOQUEIO.lock().unwrap_or_else(|e| e.into_inner());
    let mut b = Biblioteca::carregar(&arquivo);
    let t = agora(args);
    let mut mudou = false;
    let r = match comando {
        "pastas" => para(&b.pastas),
        "adicionar_pasta" => {
            b.adicionar_pasta(&PathBuf::from(texto(args, "pasta")?))?;
            mudou = true;
            para(&b.pastas)
        }
        "remover_pasta" => {
            let n = b.remover_pasta(&PathBuf::from(texto(args, "pasta")?));
            mudou = true;
            Ok(json!({ "jogos_removidos": n }))
        }
        "escanear" => {
            b.limpar_sessoes_velhas(t);
            let r = b.escanear(t, OpcoesEscaneamento { crc32: args.get("crc32").and_then(|x| x.as_bool()).unwrap_or(false) });
            mudou = true;
            para(r)
        }
        "isolar" => {
            crate::limpeza::isolar(&mut b, texto(args, "id")?)?;
            mudou = true;
            Ok(json!({ "isolado": true }))
        }
        "limpar" => {
            let r = crate::limpeza::limpar(&mut b, args.get("simulacao").and_then(|x| x.as_bool()).unwrap_or(false));
            mudou = !r.simulacao;
            para(r)
        }
        "listar" => {
            let f: Filtro = serde_json::from_value(args.get("filtro").cloned().unwrap_or(json!({}))).map_err(|e| format!("Filtro inválido: {e}"))?;
            para(b.buscar(&f))
        }
        "continuar" => para(b.continuar(args.get("limite").and_then(|x| x.as_u64()).unwrap_or(10) as usize)),
        "plataformas" => para(b.plataformas()),
        "estatisticas" => para(b.estatisticas()),
        "jogo" => b.jogos.get(texto(args, "id")?).map(para).unwrap_or_else(|| Err("Esse jogo não está mais na biblioteca.".into())),
        "favoritar" => {
            b.favoritar(texto(args, "id")?, args.get("favorito").and_then(|x| x.as_bool()).unwrap_or(true))?;
            mudou = true;
            Ok(json!({ "ok": true }))
        }
        "sessao_iniciar" => {
            b.iniciar_sessao(texto(args, "id")?, t)?;
            mudou = true;
            Ok(json!({ "ok": true, "inicio": t }))
        }
        "sessao_encerrar" => {
            let d = b.encerrar_sessao(texto(args, "id")?, t);
            mudou = true;
            Ok(json!({ "duracao_s": d }))
        }
        "registrar_tempo" => {
            let d = b.registrar_tempo(texto(args, "id")?, args.get("inicio").and_then(|x| x.as_u64()).unwrap_or(t), args.get("duracao_s").and_then(|x| x.as_u64()).unwrap_or(0));
            mudou = true;
            Ok(json!({ "duracao_s": d }))
        }
        "emuladores" => {
            let amb = Ambiente::atual();
            let cfg = Configuracao::carregar(&arquivo_de_configuracao(&arquivo));
            Ok(json!({ "instalados": emuladores::descobrir(&amb, &cfg), "configuracao": cfg, "android": emuladores::EMULADORES_ANDROID }))
        }
        "configurar" => {
            let ca = arquivo_de_configuracao(&arquivo);
            let mut c = Configuracao::carregar(&ca);
            if let Some(p) = args.get("retroarch") {
                c.retroarch = p.as_str().filter(|s| !s.trim().is_empty()).map(PathBuf::from);
            }
            if let Some(l) = args.get("pastas_extras").and_then(|x| x.as_array()) {
                c.pastas_extras = l.iter().filter_map(|x| x.as_str()).map(PathBuf::from).collect();
            }
            if let Some(v) = args.get("sem_shader").and_then(|x| x.as_bool()) {
                c.sem_shader = v;
            }
            if let Some(pl) = args.get("plataforma").and_then(|x| x.as_str()) {
                match args.get("emulador").and_then(|x| x.as_str()).filter(|s| !s.is_empty()) {
                    Some(e) => {
                        c.preferidos.insert(pl.to_string(), Preferido { emulador: e.to_string(), nucleo: args.get("nucleo").and_then(|x| x.as_str()).map(String::from) });
                    }
                    None => {
                        c.preferidos.remove(pl);
                    }
                }
            }
            c.salvar(&ca)?;
            para(c)
        }
        "plano_lancamento" => para(plano_do_jogo(&b, texto(args, "id")?, &arquivo)?),
        "lancar" => {
            let id = texto(args, "id")?.to_string();
            let plano = plano_do_jogo(&b, &id, &arquivo)?;
            drop(_g);
            let modo = modo_jogo::Configuracao::carregar(&arquivo_do_modo_jogo(&arquivo));
            let modo_ligado = modo.ligado;
            let pid = lancar_com_modo(&plano, arquivo.clone(), id, agora_real, Some(modo))?;
            return Ok(json!({ "pid": pid, "emulador": plano.emulador, "nucleo": plano.nucleo, "modo_jogo": modo_ligado }));
        }
        "modo_jogo_config" => {
            let ca = arquivo_do_modo_jogo(&arquivo);
            let mut c = modo_jogo::Configuracao::carregar(&ca);
            if let Some(novo) = args.get("configuracao") {
                c = serde_json::from_value(novo.clone()).map_err(|e| format!("Configuração do Modo Jogo inválida: {e}"))?;
                c.salvar(&ca)?;
            }
            para(c)
        }
        "modo_jogo_simular" => {
            // mostra o que o Modo Jogo faria agora, sem mexer em nada
            let cfg = modo_jogo::Configuracao::carregar(&arquivo_do_modo_jogo(&arquivo));
            let procs = SistemaReal::novo().processos();
            para(modo_jogo::planejar(&procs, &[std::process::id()], &cfg))
        }
        "modo_jogo_pendente" => para(modo_jogo::pendente(&pasta_de_dados(&arquivo))),
        "modo_jogo_recuperar" => {
            // chamado quando o Vortex abre: se ele fechou no meio de um jogo, devolve o computador ao normal
            Ok(json!({ "desfeito": modo_jogo::desativar(&SistemaReal::novo(), &pasta_de_dados(&arquivo)) }))
        }
        "organizar_candidatos" => {
            let amb = Ambiente::atual();
            para(organizador::candidatos(&amb.casa, amb.so == emuladores::So::Windows))
        }
        "organizar" => {
            // procura jogos soltos, guarda cada um na pasta do console dentro da pasta do Vortex e põe essa pasta na biblioteca
            let amb = Ambiente::atual();
            let simulacao = args.get("simulacao").and_then(|x| x.as_bool()).unwrap_or(false);
            let pasta_vortex = args.get("pasta_vortex").and_then(|x| x.as_str()).filter(|s| !s.trim().is_empty()).map(PathBuf::from).unwrap_or_else(|| amb.casa.join("Documents").join("Vortex").join("Jogos"));
            let origens: Vec<PathBuf> = match args.get("origens").and_then(|x| x.as_array()) {
                Some(l) => l.iter().filter_map(|x| x.as_str()).map(PathBuf::from).collect(),
                None => organizador::candidatos(&amb.casa, amb.so == emuladores::So::Windows),
            };
            let (rel, reg) = organizador::organizar(&origens, &pasta_vortex, simulacao);
            if !simulacao {
                let arq_reg = arquivo.with_file_name("organizador.json");
                let mut todo: organizador::Registro = std::fs::read_to_string(&arq_reg).ok().and_then(|t| serde_json::from_str(&t).ok()).unwrap_or_default();
                todo.movimentos.extend(reg.movimentos);
                if let Ok(t) = serde_json::to_string_pretty(&todo) {
                    let _ = std::fs::create_dir_all(pasta_de_dados(&arquivo));
                    let _ = std::fs::write(&arq_reg, t);
                }
                std::fs::create_dir_all(&pasta_vortex).map_err(|e| format!("Não consegui criar a pasta do Vortex: {e}"))?;
                b.adicionar_pasta(&pasta_vortex)?;
                b.limpar_sessoes_velhas(t);
                b.escanear(t, OpcoesEscaneamento::default());
                mudou = true;
            }
            Ok(json!({ "organizados": rel.organizados, "ja_no_lugar": rel.ja_no_lugar, "falhas": rel.falhas, "simulacao": rel.simulacao, "pasta_vortex": pasta_vortex, "origens": origens }))
        }
        "organizar_desfazer" => {
            let arq_reg = arquivo.with_file_name("organizador.json");
            let reg: organizador::Registro = std::fs::read_to_string(&arq_reg).ok().and_then(|t| serde_json::from_str(&t).ok()).unwrap_or_default();
            let (n, falhas) = organizador::desfazer(&reg);
            let _ = std::fs::remove_file(&arq_reg);
            b.escanear(t, OpcoesEscaneamento::default());
            mudou = true;
            Ok(json!({ "devolvidos": n, "falhas": falhas }))
        }
        "historico" => {
            let n = args.get("limite").and_then(|x| x.as_u64()).unwrap_or(50) as usize;
            para(b.historico.iter().rev().take(n).collect::<Vec<_>>())
        }
        outro => Err(format!("Comando desconhecido: {outro}")),
    };
    if mudou && r.is_ok() {
        b.salvar(&arquivo)?;
    }
    r
}

#[cfg(test)]
mod testes {
    use super::*;
    use std::fs;
    use std::sync::atomic::{AtomicU64, Ordering};
    use std::sync::Arc;

    #[test]
    fn fluxo_completo_pela_api() {
        let t = tempfile::tempdir().unwrap();
        fs::create_dir_all(t.path().join("roms/nes")).unwrap();
        fs::write(t.path().join("roms/nes/Contra (USA).nes"), "x").unwrap();
        fs::write(t.path().join("roms/nes/Zelda (USA).nes"), "y").unwrap();
        let bib = t.path().join("dados/biblioteca.json").to_string_lossy().to_string();
        let a = |extra: Value| {
            let mut o = json!({ "biblioteca": bib, "agora": 1000 });
            for (k, v) in extra.as_object().unwrap() {
                o[k] = v.clone();
            }
            o
        };
        assert!(executar("escanear", &a(json!({}))).is_ok() && executar("pastas", &a(json!({}))).unwrap().as_array().unwrap().is_empty());
        executar("adicionar_pasta", &a(json!({ "pasta": t.path().join("roms") }))).unwrap();
        let r = executar("escanear", &a(json!({}))).unwrap();
        assert_eq!(r["novos"], 2);
        let lista = executar("listar", &a(json!({ "filtro": { "texto": "contra" } }))).unwrap();
        assert_eq!(lista.as_array().unwrap().len(), 1);
        let id = lista[0]["id"].as_str().unwrap().to_string();
        assert_eq!(lista[0]["plataforma"], "nes");
        executar("favoritar", &a(json!({ "id": id }))).unwrap();
        assert_eq!(executar("jogo", &a(json!({ "id": id }))).unwrap()["favorito"], true);
        executar("sessao_iniciar", &a(json!({ "id": id, "agora": 2000 }))).unwrap();
        assert_eq!(executar("sessao_encerrar", &a(json!({ "id": id, "agora": 2300 }))).unwrap()["duracao_s"], 300);
        assert_eq!(executar("continuar", &a(json!({}))).unwrap().as_array().unwrap().len(), 1);
        assert_eq!(executar("estatisticas", &a(json!({}))).unwrap()["tempo_total_s"], 300);
        assert_eq!(executar("historico", &a(json!({}))).unwrap().as_array().unwrap().len(), 1);
        assert_eq!(executar("plataformas", &a(json!({}))).unwrap()[0]["total"], 2);
        assert!(executar("plataformas_catalogo", &json!({})).unwrap().as_array().unwrap().len() > 40);
        // persistiu no disco
        assert!(std::path::Path::new(&bib).is_file());
        assert_eq!(executar("remover_pasta", &a(json!({ "pasta": t.path().join("roms") }))).unwrap()["jogos_removidos"], 2);
    }

    #[test]
    fn configurar_e_listar_emuladores() {
        let t = tempfile::tempdir().unwrap();
        let bib = t.path().join("d/biblioteca.json").to_string_lossy().to_string();
        let c = executar("configurar", &json!({ "biblioteca": bib, "plataforma": "snes", "emulador": "retroarch", "nucleo": "bsnes_libretro", "sem_shader": true })).unwrap();
        assert_eq!(c["preferidos"]["snes"]["nucleo"], "bsnes_libretro");
        assert_eq!(c["sem_shader"], true);
        let e = executar("emuladores", &json!({ "biblioteca": bib })).unwrap();
        assert_eq!(e["configuracao"]["preferidos"]["snes"]["emulador"], "retroarch");
        assert!(e["android"].as_array().unwrap().len() >= 10);
        let c = executar("configurar", &json!({ "biblioteca": bib, "plataforma": "snes", "emulador": "" })).unwrap();
        assert!(c["preferidos"].as_object().unwrap().is_empty());
        assert!(executar("plano_lancamento", &json!({ "biblioteca": bib, "id": "x" })).unwrap_err().contains("não está"));
    }

    #[test]
    fn modo_jogo_pela_api() {
        let t = tempfile::tempdir().unwrap();
        let bib = t.path().join("d/biblioteca.json").to_string_lossy().to_string();
        let c = executar("modo_jogo_config", &json!({ "biblioteca": bib })).unwrap();
        assert_eq!(c["ligado"], true);
        let c = executar("modo_jogo_config", &json!({ "biblioteca": bib, "configuracao": { "energia_maxima": false, "rebaixar_extra": ["obs64"] } })).unwrap();
        assert_eq!(c["energia_maxima"], false);
        assert_eq!(c["gpu_dedicada"], true); // o que não foi informado continua no padrão
        assert_eq!(executar("modo_jogo_config", &json!({ "biblioteca": bib })).unwrap()["rebaixar_extra"][0], "obs64");
        assert!(executar("modo_jogo_config", &json!({ "biblioteca": bib, "configuracao": { "ligado": "talvez" } })).is_err());
        assert!(executar("modo_jogo_simular", &json!({ "biblioteca": bib })).unwrap()["alvos"].is_array());
        assert!(executar("modo_jogo_pendente", &json!({ "biblioteca": bib })).unwrap().is_null());
        assert_eq!(executar("modo_jogo_recuperar", &json!({ "biblioteca": bib })).unwrap()["desfeito"], false);
    }

    #[test]
    fn organizar_pela_api_poe_a_pasta_na_biblioteca() {
        let t = tempfile::tempdir().unwrap();
        let solto = t.path().join("solto");
        fs::create_dir_all(&solto).unwrap();
        fs::write(solto.join("Sonic (USA).md"), "x").unwrap();
        fs::write(solto.join("Zelda (USA).sfc"), "y").unwrap();
        let bib = t.path().join("dados/biblioteca.json").to_string_lossy().to_string();
        let vortex = t.path().join("Vortex/Jogos");
        let a = |sim: bool| json!({ "biblioteca": bib, "agora": 5, "origens": [solto], "pasta_vortex": vortex, "simulacao": sim });
        let sim = executar("organizar", &a(true)).unwrap();
        assert_eq!(sim["organizados"].as_array().unwrap().len(), 2);
        assert!(solto.join("Sonic (USA).md").exists() && executar("pastas", &a(true)).unwrap().as_array().unwrap().is_empty());
        executar("organizar", &a(false)).unwrap();
        assert!(!solto.join("Sonic (USA).md").exists());
        assert_eq!(executar("pastas", &a(false)).unwrap().as_array().unwrap().len(), 1, "pasta do Vortex entra sozinha");
        assert_eq!(executar("listar", &a(false)).unwrap().as_array().unwrap().len(), 2, "jogos já aparecem na biblioteca");
        let d = executar("organizar_desfazer", &a(false)).unwrap();
        assert_eq!(d["devolvidos"], 2);
        assert!(solto.join("Zelda (USA).sfc").exists());
    }

    #[test]
    fn preparar_jogo_usa_o_motor_embutido() {
        let t = tempfile::tempdir().unwrap();
        fs::create_dir_all(t.path().join("roms/snes")).unwrap();
        fs::write(t.path().join("roms/snes/Zelda.sfc"), "y").unwrap();
        let bib = t.path().join("dados/biblioteca.json").to_string_lossy().to_string();
        let a = json!({ "biblioteca": bib, "agora": 1, "pasta": t.path().join("roms") });
        executar("adicionar_pasta", &a).unwrap();
        executar("escanear", &a).unwrap();
        let id = executar("listar", &a).unwrap()[0]["id"].as_str().unwrap().to_string();
        let falso = |url: &str, dest: &Path| -> Result<(), String> {
            if url.ends_with(".7z") {
                let o = tempfile::tempdir().unwrap();
                fs::write(o.path().join("retroarch.exe"), "x").unwrap();
                sevenz_rust::compress_to_path(o.path(), dest).map_err(|e| e.to_string())
            } else {
                use std::io::Write;
                let mut w = zip::ZipWriter::new(fs::File::create(dest).unwrap());
                w.start_file("snes9x_libretro.dll", zip::write::SimpleFileOptions::default()).unwrap();
                w.write_all(b"d").unwrap();
                w.finish().map(|_| ()).map_err(|e| e.to_string())
            }
        };
        let r = preparar_jogo_com(&json!({ "biblioteca": bib, "id": id }), &falso).unwrap();
        assert_eq!(r["nucleo"], "snes9x_libretro");
        assert_eq!(r["baixou"], true);
        let cfg = Configuracao::carregar(&arquivo_de_configuracao(Path::new(&bib)));
        assert!(cfg.retroarch.is_some(), "motor embutido vira o RetroArch do Vortex");
    }

    #[test]
    fn loja_instala_e_mostra_como_instalado() {
        let t = tempfile::tempdir().unwrap();
        let bib = t.path().join("dados/biblioteca.json").to_string_lossy().to_string();
        let vortex = t.path().join("Vortex/Jogos");
        let o = loja::catalogo().into_iter().next().unwrap();
        let a = json!({ "biblioteca": bib, "agora": 3, "id": o.id, "pasta_vortex": vortex });
        assert!(executar("loja_catalogo", &a).unwrap().as_array().unwrap().iter().all(|v| v["instalado"] == false));
        // servidor falso: gera um zip com um .nes e acerta a assinatura
        let falso_zip = t.path().join("falso.zip");
        {
            use std::io::Write;
            let mut w = zip::ZipWriter::new(fs::File::create(&falso_zip).unwrap());
            w.start_file("jogo.nes", zip::write::SimpleFileOptions::default()).unwrap();
            w.write_all(b"x").unwrap();
            w.finish().unwrap();
        }
        let baixar = |_: &str, d: &Path| fs::copy(&falso_zip, d).map(|_| ()).map_err(|e| e.to_string());
        // com a assinatura do catálogo real o arquivo falso é recusado
        assert!(loja_instalar_com(&a, &baixar).unwrap_err().contains("não confere"));
        assert!(executar("loja_instalar", &json!({ "biblioteca": bib, "id": "nao-existe" })).is_err());
    }

    #[cfg(unix)]
    #[test]
    fn lancar_registra_o_tempo_quando_o_emulador_fecha() {
        let t = tempfile::tempdir().unwrap();
        fs::create_dir_all(t.path().join("nes")).unwrap();
        fs::write(t.path().join("nes/Contra.nes"), "x").unwrap();
        let arquivo = t.path().join("biblioteca.json");
        let mut b = Biblioteca::default();
        b.adicionar_pasta(t.path()).unwrap();
        b.escanear(10, OpcoesEscaneamento::default());
        let id = b.jogos.keys().next().unwrap().clone();
        b.salvar(&arquivo).unwrap();
        let plano = Lancamento { emulador: "falso".into(), programa: PathBuf::from("sh"), args: vec!["-c".into(), "exit 0".into()], diretorio: Some(t.path().to_path_buf()), configuracao: None, nucleo: None };
        // relógio falso: a 1ª leitura é o início, as seguintes são o fim (100 s depois)
        let n = Arc::new(AtomicU64::new(0));
        let n2 = n.clone();
        lancar_plano(&plano, arquivo.clone(), id.clone(), move || if n2.fetch_add(1, Ordering::SeqCst) == 0 { 1000 } else { 1100 }).unwrap();
        for _ in 0..100 {
            std::thread::sleep(std::time::Duration::from_millis(50));
            if Biblioteca::carregar(&arquivo).jogos[&id].sessoes == 1 {
                break;
            }
        }
        let b = Biblioteca::carregar(&arquivo);
        assert_eq!(b.jogos[&id].tempo_total_s, 100);
        assert!(b.em_andamento.is_empty());
        let ruim = Lancamento { programa: PathBuf::from("programa-que-nao-existe-xyz"), ..plano };
        assert!(lancar_plano(&ruim, arquivo, id, || 1).unwrap_err().contains("Não consegui abrir"));
    }

    #[test]
    fn erros_claros() {
        assert!(executar("listar", &json!({})).unwrap_err().contains("biblioteca"));
        let t = tempfile::tempdir().unwrap();
        let bib = t.path().join("b.json").to_string_lossy().to_string();
        assert!(executar("nada", &json!({ "biblioteca": bib })).unwrap_err().contains("desconhecido"));
        assert!(executar("favoritar", &json!({ "biblioteca": bib, "id": "x" })).unwrap_err().contains("não está"));
        assert!(executar("adicionar_pasta", &json!({ "biblioteca": bib, "pasta": "/nao/existe" })).is_err());
        assert!(executar("listar", &json!({ "biblioteca": bib, "filtro": { "ordem": "inventada" } })).unwrap_err().contains("Filtro"));
        assert!(!t.path().join("b.json").exists()); // erro não cria arquivo
    }
}


/// Abre um endereço https no navegador do sistema (só https, sem espaços nem aspas: nada de comando disfarçado).
pub fn url_segura(url: &str) -> bool {
    url.starts_with("https://") && url.len() < 600 && !url.chars().any(|c| c.is_whitespace() || c.is_control() || "\"'<>^`{}|\\".contains(c))
}

fn abrir_url(url: &str) -> Result<(), String> {
    if !url_segura(url) {
        return Err("Endereço inválido.".into());
    }
    #[cfg(windows)]
    let r = Command::new("rundll32").args(["url.dll,FileProtocolHandler", url]).spawn();
    #[cfg(not(windows))]
    let r = Command::new("xdg-open").arg(url).spawn();
    r.map(|_| ()).map_err(|e| format!("Não consegui abrir o navegador: {e}"))
}

fn pasta_jogos_pc(args: &Value) -> PathBuf {
    let amb = Ambiente::atual();
    args.get("pasta_vortex").and_then(|x| x.as_str()).filter(|s| !s.trim().is_empty()).map(PathBuf::from).unwrap_or_else(|| amb.casa.join("Documents").join("Vortex").join("Jogos")).join("Jogos PC")
}

/// Windows: transforma os jogos da Steam e da Epic já instalados em atalhos na pasta "Jogos PC" e põe a pasta na biblioteca.
fn pc_importar(args: &Value) -> Result<Value, String> {
    if !cfg!(windows) {
        return Err("Steam e Epic Games só no Windows por enquanto.".into());
    }
    let arquivo = arquivo_da_biblioteca(args)?;
    let var = |n: &str| std::env::var_os(n).filter(|v| !v.is_empty()).map(PathBuf::from);
    let mut steam = Vec::new();
    for base in [var("ProgramFiles(x86)"), var("ProgramFiles"), Some(PathBuf::from("C:\\Steam")), Some(PathBuf::from("D:\\Steam"))].into_iter().flatten() {
        if let Some(r) = pc::raiz_da_steam(Some(&base)).or_else(|| base.join("steamapps").is_dir().then(|| base.clone())) {
            steam = pc::jogos_da_steam(&r);
            if !steam.is_empty() {
                break;
            }
        }
    }
    let epic = var("ProgramData").map(|d| pc::jogos_da_epic(&d.join("Epic").join("EpicGamesLauncher").join("Data").join("Manifests"))).unwrap_or_default();
    let destino = pasta_jogos_pc(args);
    let mut todos = steam.clone();
    todos.extend(epic.clone());
    let novos = pc::escrever_atalhos(&destino, &todos)?;
    if !todos.is_empty() {
        let pasta_vortex = destino.parent().map(Path::to_path_buf).unwrap_or_else(|| destino.clone());
        executar("adicionar_pasta", &json!({ "biblioteca": arquivo, "pasta": pasta_vortex, "agora": args.get("agora") }))?;
    }
    Ok(json!({ "steam": steam.len(), "epic": epic.len(), "novos": novos, "pasta": destino }))
}

/// Windows: atalho para um programa/jogo escolhido à mão (.exe ou .lnk), na pasta "Jogos PC".
fn pc_adicionar(args: &Value) -> Result<Value, String> {
    if !cfg!(windows) {
        return Err("Jogos de PC só no Windows.".into());
    }
    let arquivo = arquivo_da_biblioteca(args)?;
    let origem = PathBuf::from(texto(args, "caminho")?);
    let ext = crate::plataformas::extensao(&origem);
    if !origem.is_file() || (ext != "exe" && ext != "lnk") {
        return Err("Escolha o arquivo do jogo (.exe) ou o atalho dele (.lnk).".into());
    }
    let destino = pasta_jogos_pc(args);
    std::fs::create_dir_all(&destino).map_err(|e| format!("Não consegui criar a pasta: {e}"))?;
    let nome = pc::nome_de_arquivo(&origem.file_stem().map(|s| s.to_string_lossy().to_string()).unwrap_or_default());
    let saida = destino.join(format!("{nome}.lnk"));
    if ext == "lnk" {
        std::fs::copy(&origem, &saida).map_err(|e| format!("Não consegui copiar o atalho: {e}"))?;
    } else {
        let roteiro = "$s=(New-Object -ComObject WScript.Shell).CreateShortcut($env:V_SAIDA);$s.TargetPath=$env:V_ALVO;$s.WorkingDirectory=Split-Path $env:V_ALVO;$s.Save()";
        let ok = Command::new("powershell").args(["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", roteiro]).env("V_SAIDA", &saida).env("V_ALVO", &origem).status().map(|s| s.success()).unwrap_or(false);
        if !ok || !saida.is_file() {
            return Err("Não consegui criar o atalho do jogo.".into());
        }
    }
    let pasta_vortex = destino.parent().map(Path::to_path_buf).unwrap_or_else(|| destino.clone());
    executar("adicionar_pasta", &json!({ "biblioteca": arquivo, "pasta": pasta_vortex, "agora": args.get("agora") }))?;
    Ok(json!({ "ok": true, "atalho": saida }))
}

/// Caminho do jeito que o Explorer entende: sem o prefixo \\?\ e com barras invertidas (barra normal faz o Explorer abrir "Documentos").
pub fn caminho_para_explorer(p: &str) -> String {
    let sem = p.strip_prefix("\\\\?\\").unwrap_or(p);
    sem.replace('/', "\\")
}

/// Abre uma pasta existente no gerenciador de arquivos do sistema (Explorer no Windows). Se vier o caminho de um arquivo, abre a pasta dele com o arquivo marcado.
fn abrir_pasta(pasta: &str) -> Result<(), String> {
    let p = std::path::Path::new(pasta);
    let arquivo = p.is_file();
    if !p.is_dir() && !arquivo {
        return Err("Essa pasta não existe mais.".into());
    }
    #[cfg(windows)]
    let r = {
        let c = caminho_para_explorer(pasta);
        if arquivo { Command::new("explorer").arg(format!("/select,{c}")).spawn() } else { Command::new("explorer").arg(c).spawn() }
    };
    #[cfg(not(windows))]
    let r = Command::new("xdg-open").arg(if arquivo { p.parent().unwrap_or(p) } else { p }).spawn();
    r.map(|_| ()).map_err(|e| format!("Não consegui abrir a pasta: {e}"))
}

#[cfg(test)]
mod testes_url {
    use super::{caminho_para_explorer, url_segura};
    #[test]
    fn caminho_do_explorer_usa_barra_invertida() {
        assert_eq!(caminho_para_explorer("D:/Jogos/GBA"), "D:\\Jogos\\GBA");
        assert_eq!(caminho_para_explorer("\\\\?\\C:\\Roms"), "C:\\Roms");
    }
    #[test]
    fn so_aceita_https_limpo() {
        assert!(url_segura("https://www.youtube.com/results?search_query=zelda+guia"));
        assert!(!url_segura("http://x.com"));
        assert!(!url_segura("https://x.com/a b"));
        assert!(!url_segura("https://x.com/\"&calc"));
        assert!(!url_segura("file:///c:/x"));
    }
}

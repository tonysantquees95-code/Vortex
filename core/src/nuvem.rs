//! Conta Vetorial ID e saves na nuvem do Vortex. A regra dos aparelhos (3 vinculados, 2 ao mesmo tempo) e a licença
//! são do servidor; aqui o Vortex entra, guarda o token e sincroniza os saves sem nunca apagar um save sem avisar.
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use std::collections::HashMap;
use std::path::{Path, PathBuf};

pub const SERVIDOR: &str = "https://venus-servidor.tonysantquees95.workers.dev";

pub struct Resposta {
    pub status: u16,
    pub corpo: Vec<u8>,
    pub versao: Option<u64>,
}

/// A rede por trás de uma interface pequena (nos testes entra um servidor de mentira).
pub trait Rede {
    fn pedir(&self, metodo: &str, caminho: &str, token: Option<&str>, corpo: Option<&[u8]>, base: Option<u64>) -> Result<Resposta, String>;
}

pub struct RedeReal;

impl Rede for RedeReal {
    fn pedir(&self, metodo: &str, caminho: &str, token: Option<&str>, corpo: Option<&[u8]>, base: Option<u64>) -> Result<Resposta, String> {
        let agente = ureq::AgentBuilder::new().timeout(std::time::Duration::from_secs(30)).build();
        let mut r = agente.request(metodo, &format!("{SERVIDOR}{caminho}"));
        if let Some(t) = token {
            r = r.set("authorization", &format!("Bearer {t}"));
        }
        if let Some(b) = base {
            r = r.set("x-base", &b.to_string());
        }
        let res = match corpo {
            Some(c) => r.set("content-type", "application/octet-stream").send_bytes(c),
            None => r.call(),
        };
        let res = match res {
            Ok(x) => x,
            Err(ureq::Error::Status(_, x)) => x,
            Err(e) => return Err(format!("Sem conexão com o servidor da Vetorial: {e}")),
        };
        let status = res.status();
        let versao = res.header("x-versao").and_then(|v| v.parse().ok());
        let mut buf = Vec::new();
        std::io::Read::take(res.into_reader(), 9 * 1024 * 1024).read_to_end(&mut buf).map_err(|e| e.to_string())?;
        Ok(Resposta { status, corpo: buf, versao })
    }
}

use std::io::Read;

#[derive(Serialize, Deserialize, Clone, Default, Debug)]
pub struct Conta {
    pub token: String,
    pub email: String,
    pub dispositivo: String,
    /// Recibo de licença assinado pelo servidor (Ed25519); quem confere é o app, sem internet.
    #[serde(default)]
    pub selo: String,
}

fn arquivo_conta(dados: &Path) -> PathBuf {
    dados.join("conta.json")
}

pub fn conta_salva(dados: &Path) -> Option<Conta> {
    std::fs::read_to_string(arquivo_conta(dados)).ok().and_then(|t| serde_json::from_str(&t).ok()).filter(|c: &Conta| !c.token.is_empty())
}

/// Identificador estável deste aparelho (nunca muda, para o servidor reconhecê-lo).
pub fn id_do_aparelho(dados: &Path) -> String {
    let f = dados.join("aparelho.id");
    if let Ok(t) = std::fs::read_to_string(&f) {
        if t.trim().len() >= 16 {
            return t.trim().to_string();
        }
    }
    let mut h = Sha256::new();
    h.update(std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map(|d| d.as_nanos()).unwrap_or(0).to_le_bytes());
    h.update(std::process::id().to_le_bytes());
    h.update(format!("{:?}", std::collections::hash_map::RandomState::new().build_hasher_hash()).as_bytes());
    let id: String = h.finalize().iter().map(|b| format!("{b:02x}")).collect::<String>()[..32].to_string();
    let _ = std::fs::create_dir_all(dados);
    let _ = std::fs::write(&f, &id);
    id
}

trait HashAleatorio {
    fn build_hasher_hash(&self) -> u64;
}
impl HashAleatorio for std::collections::hash_map::RandomState {
    fn build_hasher_hash(&self) -> u64 {
        use std::hash::{BuildHasher, Hasher};
        let mut h = self.build_hasher();
        h.write_u8(7);
        h.finish()
    }
}

fn mensagem(r: &Resposta) -> String {
    serde_json::from_slice::<Value>(&r.corpo).ok().and_then(|v| v.get("error").and_then(|e| e.as_str()).map(String::from)).unwrap_or_else(|| format!("O servidor respondeu {}.", r.status))
}

pub fn entrar(rede: &dyn Rede, dados: &Path, email: &str, senha: &str, nome_aparelho: &str, plataforma: &str) -> Result<Conta, String> {
    let dispositivo = id_do_aparelho(dados);
    let corpo = json!({ "email": email.trim(), "senha": senha, "dispositivo": { "id": dispositivo, "nome": nome_aparelho, "plataforma": plataforma } });
    let r = rede.pedir("POST", "/id/entrar", None, Some(corpo.to_string().as_bytes()), None)?;
    if r.status != 200 {
        return Err(mensagem(&r));
    }
    let v: Value = serde_json::from_slice(&r.corpo).map_err(|e| e.to_string())?;
    let token = v.get("token").and_then(|t| t.as_str()).ok_or("O servidor não devolveu o login.")?.to_string();
    let selo = v.get("selo").and_then(|t| t.as_str()).unwrap_or("").to_string();
    let conta = Conta { token, email: email.trim().to_lowercase(), dispositivo, selo };
    std::fs::create_dir_all(dados).map_err(|e| e.to_string())?;
    std::fs::write(arquivo_conta(dados), serde_json::to_string(&conta).unwrap()).map_err(|e| e.to_string())?;
    Ok(conta)
}

pub fn sair(rede: &dyn Rede, dados: &Path) {
    if let Some(c) = conta_salva(dados) {
        let _ = rede.pedir("POST", "/id/sair", Some(&c.token), Some(b"{}"), None);
    }
    let _ = std::fs::remove_file(arquivo_conta(dados));
}

/// {logado, email, vortex (liberado), selo, mensagem}. Se o servidor recusar o login, a conta salva é descartada.
/// O `selo` é o recibo assinado da licença: o app confere a assinatura e decide se abre (sem internet também).
pub fn estado(rede: &dyn Rede, dados: &Path) -> Value {
    let Some(mut c) = conta_salva(dados) else { return json!({ "logado": false, "vortex": false }) };
    match rede.pedir("GET", "/id/verificar", Some(&c.token), None, None) {
        Ok(r) if r.status == 200 => {
            let v: Value = serde_json::from_slice(&r.corpo).unwrap_or(Value::Null);
            if let Some(novo) = v.get("licenca").and_then(|l| l.get("selo")).and_then(|x| x.as_str()) {
                if novo != c.selo {
                    c.selo = novo.to_string();
                    let _ = std::fs::write(arquivo_conta(dados), serde_json::to_string(&c).unwrap());
                }
            }
        }
        Ok(r) if r.status == 401 || r.status == 403 => {
            let _ = std::fs::remove_file(arquivo_conta(dados));
            return json!({ "logado": false, "vortex": false, "mensagem": "Sua sessão terminou. Entre de novo." });
        }
        _ => {}
    }
    match rede.pedir("GET", "/vortex/licenca", Some(&c.token), None, None) {
        Ok(r) if r.status == 200 => {
            let v: Value = serde_json::from_slice(&r.corpo).unwrap_or(Value::Null);
            json!({ "logado": true, "email": c.email, "selo": c.selo, "vortex": v.get("vortex").and_then(|x| x.as_bool()).unwrap_or(false), "mensagem": v.get("mensagem").cloned().unwrap_or(json!("")) })
        }
        Ok(r) if r.status == 401 || r.status == 403 => {
            let _ = std::fs::remove_file(arquivo_conta(dados));
            json!({ "logado": false, "vortex": false, "mensagem": "Sua sessão terminou. Entre de novo." })
        }
        Ok(r) => json!({ "logado": true, "email": c.email, "selo": c.selo, "vortex": false, "mensagem": mensagem(&r) }),
        // sem internet: quem decide se abre é o selo assinado (vale alguns dias offline)
        Err(_) => json!({ "logado": true, "email": c.email, "selo": c.selo, "vortex": true, "offline": true }),
    }
}

// ------------------------------------------------------------------ ponte de voz (Vênus ↔ Vortex)

/// Pedidos novos da Vênus para este aparelho: {"pedidos":[{id, comando, argumento}]}. Perguntar também avisa que o Vortex está aberto.
pub fn fila(rede: &dyn Rede, token: &str, plataforma: &str) -> Result<Value, String> {
    let r = rede.pedir("GET", &format!("/vortex/fila?plataforma={plataforma}"), Some(token), None, None)?;
    if r.status != 200 {
        return Err(mensagem(&r));
    }
    serde_json::from_slice(&r.corpo).map_err(|e| e.to_string())
}

pub fn responder(rede: &dyn Rede, token: &str, id: &str, ok: bool, resumo: &str) -> Result<(), String> {
    if id.len() != 24 || !id.chars().all(|c| c.is_ascii_hexdigit()) {
        return Err("Pedido inválido.".into());
    }
    let corpo = json!({ "ok": ok, "resumo": resumo });
    let r = rede.pedir("POST", &format!("/vortex/pedidos/{id}/resultado"), Some(token), Some(corpo.to_string().as_bytes()), None)?;
    if r.status != 200 {
        return Err(mensagem(&r));
    }
    Ok(())
}

// ------------------------------------------------------------------ saves

/// Nome do jogo igual em todos os aparelhos (o id da biblioteca depende do caminho): console + nome do arquivo.
pub fn chave_do_jogo(plataforma: &str, nome_do_arquivo: &str) -> String {
    let mut s = String::new();
    for c in nome_do_arquivo.to_lowercase().chars() {
        let c = if c.is_ascii_alphanumeric() { c } else { '-' };
        if c == '-' && (s.is_empty() || s.ends_with('-')) {
            continue;
        }
        s.push(c);
    }
    let s = s.trim_end_matches('-');
    let mut k = format!("{plataforma}-{s}");
    k.truncate(60);
    k.trim_end_matches('-').to_string()
}

pub struct ItemLocal {
    pub jogo: String,
    pub arquivo: String,
    pub caminho: PathBuf,
}

#[derive(Serialize, Deserialize, Default, Clone)]
struct Marca {
    versao: u64,
    sha: String,
}

#[derive(Serialize, Default, Debug, PartialEq)]
pub struct Relatorio {
    pub enviados: usize,
    pub baixados: usize,
    pub conflitos: Vec<String>,
    pub falhas: Vec<String>,
}

#[derive(Clone, Copy, PartialEq)]
pub enum Conflito {
    Perguntar,
    UsarLocal,
    UsarNuvem,
}

fn sha_dos_dados(d: &[u8]) -> String {
    Sha256::digest(d).iter().map(|b| format!("{b:02x}")).collect()
}

fn escrever(caminho: &Path, dados: &[u8]) -> Result<(), String> {
    if let Some(p) = caminho.parent() {
        std::fs::create_dir_all(p).map_err(|e| e.to_string())?;
    }
    let tmp = caminho.with_extension("vortex-tmp");
    std::fs::write(&tmp, dados).map_err(|e| e.to_string())?;
    std::fs::rename(&tmp, caminho).map_err(|e| e.to_string())
}

pub fn sincronizar(rede: &dyn Rede, token: &str, itens: &[ItemLocal], estado_arq: &Path, politica: Conflito) -> Result<Relatorio, String> {
    let r = rede.pedir("GET", "/vortex/saves", Some(token), None, None)?;
    if r.status != 200 {
        return Err(mensagem(&r));
    }
    let lista: Value = serde_json::from_slice(&r.corpo).map_err(|e| e.to_string())?;
    let mut nuvem: HashMap<String, u64> = HashMap::new();
    for s in lista.get("saves").and_then(|x| x.as_array()).into_iter().flatten() {
        if let (Some(j), Some(a)) = (s.get("jogo").and_then(|x| x.as_str()), s.get("arquivo").and_then(|x| x.as_str())) {
            nuvem.insert(format!("{j}/{a}"), s.get("versao").and_then(|x| x.as_u64()).unwrap_or(0));
        }
    }
    let mut estado: HashMap<String, Marca> = std::fs::read_to_string(estado_arq).ok().and_then(|t| serde_json::from_str(&t).ok()).unwrap_or_default();
    let mut rel = Relatorio::default();
    for it in itens {
        let chave = format!("{}/{}", it.jogo, it.arquivo);
        let url = format!("/vortex/saves/{}/{}", it.jogo, it.arquivo);
        let local = std::fs::read(&it.caminho).ok().filter(|d| !d.is_empty());
        let local_sha = local.as_ref().map(|d| sha_dos_dados(d));
        let remoto = nuvem.get(&chave).copied();
        let marca = estado.get(&chave).cloned();
        #[derive(PartialEq)]
        enum Acao { Nada, Enviar(u64), Baixar, Conflito }
        let acao = match (&local_sha, remoto, &marca) {
            (None, None, _) => Acao::Nada,
            (Some(_), None, _) => Acao::Enviar(0),
            (None, Some(_), _) => Acao::Baixar,
            (Some(_), Some(_), None) => Acao::Conflito,
            (Some(ls), Some(rv), Some(m)) => match (ls != &m.sha, rv != m.versao) {
                (false, false) => Acao::Nada,
                (true, false) => Acao::Enviar(m.versao),
                (false, true) => Acao::Baixar,
                (true, true) => Acao::Conflito,
            },
        };
        let acao = match (acao, politica) {
            (Acao::Conflito, Conflito::UsarLocal) => Acao::Enviar(remoto.unwrap_or(0)),
            (Acao::Conflito, Conflito::UsarNuvem) => Acao::Baixar,
            (a, _) => a,
        };
        match acao {
            Acao::Nada => {}
            Acao::Conflito => rel.conflitos.push(chave),
            Acao::Enviar(base) => match rede.pedir("PUT", &url, Some(token), local.as_deref(), Some(base)) {
                Ok(r) if r.status == 200 => {
                    let v: Value = serde_json::from_slice(&r.corpo).unwrap_or(Value::Null);
                    estado.insert(chave, Marca { versao: v.get("versao").and_then(|x| x.as_u64()).unwrap_or(base + 1), sha: local_sha.unwrap_or_default() });
                    rel.enviados += 1;
                }
                Ok(r) if r.status == 409 => rel.conflitos.push(chave),
                Ok(r) => rel.falhas.push(format!("{chave}: {}", mensagem(&r))),
                Err(e) => return Err(e),
            },
            Acao::Baixar => match rede.pedir("GET", &url, Some(token), None, None) {
                Ok(r) if r.status == 200 => {
                    // guarda uma cópia do save que estava aqui antes de trocar
                    if it.caminho.is_file() {
                        let _ = std::fs::copy(&it.caminho, it.caminho.with_extension("antes-da-nuvem"));
                    }
                    escrever(&it.caminho, &r.corpo)?;
                    estado.insert(chave, Marca { versao: r.versao.unwrap_or_else(|| remoto.unwrap_or(0)), sha: sha_dos_dados(&r.corpo) });
                    rel.baixados += 1;
                }
                Ok(r) => rel.falhas.push(format!("{chave}: {}", mensagem(&r))),
                Err(e) => return Err(e),
            },
        }
    }
    if let Some(p) = estado_arq.parent() {
        let _ = std::fs::create_dir_all(p);
    }
    std::fs::write(estado_arq, serde_json::to_string(&estado).unwrap()).map_err(|e| e.to_string())?;
    Ok(rel)
}

#[cfg(test)]
mod testes {
    use super::*;
    use std::cell::RefCell;

    /// Servidor de mentira com as mesmas regras de versão do real.
    #[derive(Default)]
    struct Falso {
        saves: RefCell<HashMap<String, (u64, Vec<u8>)>>,
    }
    impl Rede for Falso {
        fn pedir(&self, metodo: &str, caminho: &str, _t: Option<&str>, corpo: Option<&[u8]>, base: Option<u64>) -> Result<Resposta, String> {
            let ok = |status, corpo: Vec<u8>, versao| Ok(Resposta { status, corpo, versao });
            if caminho == "/vortex/saves" {
                let l: Vec<Value> = self.saves.borrow().iter().map(|(k, (v, d))| { let (j, a) = k.split_once('/').unwrap(); json!({ "jogo": j, "arquivo": a, "versao": v, "bytes": d.len() }) }).collect();
                return ok(200, json!({ "saves": l }).to_string().into_bytes(), None);
            }
            let k = caminho.trim_start_matches("/vortex/saves/").to_string();
            match metodo {
                "GET" => match self.saves.borrow().get(&k) { Some((v, d)) => ok(200, d.clone(), Some(*v)), None => ok(404, b"{}".to_vec(), None) },
                "PUT" => {
                    let mut m = self.saves.borrow_mut();
                    let atual = m.get(&k).map(|x| x.0).unwrap_or(0);
                    if m.contains_key(&k) && base.unwrap_or(0) != atual {
                        return ok(409, b"{}".to_vec(), None);
                    }
                    m.insert(k, (atual + 1, corpo.unwrap().to_vec()));
                    ok(200, json!({ "versao": atual + 1 }).to_string().into_bytes(), None)
                }
                _ => ok(400, b"{}".to_vec(), None),
            }
        }
    }

    fn item(dir: &Path, nome: &str) -> ItemLocal {
        ItemLocal { jogo: "nes-zelda".into(), arquivo: "jogo.srm".into(), caminho: dir.join(nome) }
    }

    #[test]
    fn chave_igual_em_qualquer_aparelho() {
        assert_eq!(chave_do_jogo("nes", "Super Mario Bros. (USA).nes"), "nes-super-mario-bros-usa-nes");
        assert_eq!(chave_do_jogo("snes", "  Zelda!!  "), "snes-zelda");
        assert!(chave_do_jogo("gba", &"a".repeat(200)).len() <= 60);
    }

    #[test]
    fn envia_baixa_e_nao_pisa_em_save_novo() {
        let t = tempfile::tempdir().unwrap();
        let rede = Falso::default();
        let est_a = t.path().join("a/estado.json");
        let est_b = t.path().join("b/estado.json");
        let a = item(&t.path().join("a"), "x.srm");
        let b = item(&t.path().join("b"), "x.srm");
        std::fs::create_dir_all(t.path().join("a")).unwrap();
        std::fs::write(&a.caminho, b"save 1").unwrap();
        // aparelho A envia
        let r = sincronizar(&rede, "t", &[ItemLocal { jogo: a.jogo.clone(), arquivo: a.arquivo.clone(), caminho: a.caminho.clone() }], &est_a, Conflito::Perguntar).unwrap();
        assert_eq!((r.enviados, r.baixados), (1, 0));
        // aparelho B não tem nada e baixa
        let r = sincronizar(&rede, "t", &[ItemLocal { jogo: b.jogo.clone(), arquivo: b.arquivo.clone(), caminho: b.caminho.clone() }], &est_b, Conflito::Perguntar).unwrap();
        assert_eq!(r.baixados, 1);
        assert_eq!(std::fs::read(&b.caminho).unwrap(), b"save 1");
        // B joga e envia; A baixa a versão nova sem conflito
        std::fs::write(&b.caminho, b"save 2").unwrap();
        let ib = [ItemLocal { jogo: b.jogo.clone(), arquivo: b.arquivo.clone(), caminho: b.caminho.clone() }];
        assert_eq!(sincronizar(&rede, "t", &ib, &est_b, Conflito::Perguntar).unwrap().enviados, 1);
        let ia = [ItemLocal { jogo: a.jogo.clone(), arquivo: a.arquivo.clone(), caminho: a.caminho.clone() }];
        assert_eq!(sincronizar(&rede, "t", &ia, &est_a, Conflito::Perguntar).unwrap().baixados, 1);
        assert_eq!(std::fs::read(&a.caminho).unwrap(), b"save 2");
        // sem mudanças: nada acontece
        assert_eq!(sincronizar(&rede, "t", &ia, &est_a, Conflito::Perguntar).unwrap(), Relatorio::default());
    }

    #[test]
    fn dois_aparelhos_mudaram_vira_conflito_e_nada_se_perde() {
        let t = tempfile::tempdir().unwrap();
        let rede = Falso::default();
        let (ea, eb) = (t.path().join("ea.json"), t.path().join("eb.json"));
        let (a, b) = (item(t.path(), "a.srm"), item(t.path(), "b.srm"));
        let cp = |i: &ItemLocal| [ItemLocal { jogo: i.jogo.clone(), arquivo: i.arquivo.clone(), caminho: i.caminho.clone() }];
        std::fs::write(&a.caminho, b"base").unwrap();
        sincronizar(&rede, "t", &cp(&a), &ea, Conflito::Perguntar).unwrap();
        sincronizar(&rede, "t", &cp(&b), &eb, Conflito::Perguntar).unwrap();
        std::fs::write(&a.caminho, b"do A").unwrap();
        std::fs::write(&b.caminho, b"do B").unwrap();
        assert_eq!(sincronizar(&rede, "t", &cp(&a), &ea, Conflito::Perguntar).unwrap().enviados, 1);
        let r = sincronizar(&rede, "t", &cp(&b), &eb, Conflito::Perguntar).unwrap();
        assert_eq!(r.conflitos, vec!["nes-zelda/jogo.srm".to_string()]);
        assert_eq!(std::fs::read(&b.caminho).unwrap(), b"do B"); // intacto
        // a pessoa escolhe a nuvem: o save local fica guardado ao lado
        let r = sincronizar(&rede, "t", &cp(&b), &eb, Conflito::UsarNuvem).unwrap();
        assert_eq!(r.baixados, 1);
        assert_eq!(std::fs::read(&b.caminho).unwrap(), b"do A");
        assert_eq!(std::fs::read(b.caminho.with_extension("antes-da-nuvem")).unwrap(), b"do B");
    }

    #[test]
    fn ponte_busca_a_fila_e_responde_so_com_id_valido() {
        struct P;
        impl Rede for P {
            fn pedir(&self, m: &str, c: &str, _t: Option<&str>, corpo: Option<&[u8]>, _b: Option<u64>) -> Result<Resposta, String> {
                if m == "GET" && c.starts_with("/vortex/fila?plataforma=windows") {
                    return Ok(Resposta { status: 200, corpo: json!({ "pedidos": [{ "id": "a".repeat(24), "comando": "abrir_jogo", "argumento": "Zelda" }] }).to_string().into_bytes(), versao: None });
                }
                assert!(c.ends_with("/resultado"));
                let v: Value = serde_json::from_slice(corpo.unwrap()).unwrap();
                assert_eq!(v["resumo"], "Abri Zelda.");
                Ok(Resposta { status: 200, corpo: b"{}".to_vec(), versao: None })
            }
        }
        let f = fila(&P, "t", "windows").unwrap();
        assert_eq!(f["pedidos"][0]["argumento"], "Zelda");
        responder(&P, "t", &"a".repeat(24), true, "Abri Zelda.").unwrap();
        assert!(responder(&P, "t", "../x", true, "").is_err());
    }

    #[test]
    fn entrar_guarda_o_login_e_o_aparelho_e_sair_apaga() {
        struct Login;
        impl Rede for Login {
            fn pedir(&self, _m: &str, c: &str, _t: Option<&str>, corpo: Option<&[u8]>, _b: Option<u64>) -> Result<Resposta, String> {
                if c == "/id/entrar" {
                    let v: Value = serde_json::from_slice(corpo.unwrap()).unwrap();
                    if v["senha"] != "certa" { return Ok(Resposta { status: 409, corpo: json!({ "error": "Você já tem 3 aparelhos vinculados." }).to_string().into_bytes(), versao: None }); }
                    assert!(v["dispositivo"]["id"].as_str().unwrap().len() >= 16);
                    return Ok(Resposta { status: 200, corpo: json!({ "token": "jwt" }).to_string().into_bytes(), versao: None });
                }
                Ok(Resposta { status: 200, corpo: json!({ "vortex": true }).to_string().into_bytes(), versao: None })
            }
        }
        let t = tempfile::tempdir().unwrap();
        assert!(entrar(&Login, t.path(), "a@b.c", "errada", "PC", "windows").unwrap_err().contains("3 aparelhos"));
        let c = entrar(&Login, t.path(), " A@B.C ", "certa", "PC", "windows").unwrap();
        assert_eq!(c.email, "a@b.c");
        assert_eq!(id_do_aparelho(t.path()), c.dispositivo);
        assert_eq!(estado(&Login, t.path())["vortex"], true);
        sair(&Login, t.path());
        assert_eq!(estado(&Login, t.path())["logado"], false);
    }
}

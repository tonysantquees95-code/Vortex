//! Biblioteca de jogos do Vortex: varre as pastas escolhidas, identifica cada ROM, junta título, região, capa e descrição,
//! guarda favoritos e o histórico de tempo de jogo, e salva tudo num arquivo JSON (gravação atômica).
use crate::hash;
use crate::midia::{self, Info};
use crate::plataformas::{self, normalizar, por_id, Plataforma};
use crate::titulo::{self, Titulo};
use serde::{Deserialize, Serialize};
use std::collections::{BTreeMap, HashMap, HashSet};
use std::fs;
use std::path::{Path, PathBuf};
use walkdir::WalkDir;

pub const VERSAO: u32 = 1;
const LIMITE_HISTORICO: usize = 3000;
const SESSAO_MINIMA_S: u64 = 10;
const SESSAO_MAXIMA_S: u64 = 24 * 3600;
const LIMITE_CRC: u64 = 64 * 1024 * 1024;
/// Pastas que nunca contêm jogos (extras de frontends, saves, BIOS…), já normalizadas.
const IGNORAR_PASTAS: &[&str] = &[
    "bios", "media", "images", "image", "covers", "cover", "boxart", "boxarts", "namedboxarts", "downloadedmedia", "downloadedimages", "manuals", "manual", "saves", "states", "savestates",
    "screenshots", "snaps", "thumbnails", "cheats", "system", "vindexquarentena", "videos", "marquees", "fanart", "wheel", "backups",
];

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Jogo {
    pub id: String,
    pub titulo: String,
    pub plataforma: String,
    pub caminho: PathBuf,
    pub raiz: PathBuf,
    pub bytes: u64,
    pub modificado: u64,
    pub regioes: Vec<String>,
    pub idiomas: Vec<String>,
    pub tags: Vec<String>,
    pub disco: Option<u32>,
    /// chave que une o mesmo jogo em regiões/revisões diferentes
    pub grupo: String,
    pub capa: Option<PathBuf>,
    pub capa_online: Option<String>,
    pub descricao: Option<String>,
    pub desenvolvedor: Option<String>,
    pub editora: Option<String>,
    pub ano: Option<u32>,
    pub genero: Option<String>,
    pub jogadores: Option<String>,
    pub crc32: Option<String>,
    pub adicionado: u64,
    pub favorito: bool,
    pub ultimo_jogo: u64,
    pub tempo_total_s: u64,
    pub sessoes: u32,
    /// outra versão do mesmo jogo é a preferida (região, sem beta/hack); some das listas comuns
    pub escondido: bool,
    /// false quando a pasta/disco de origem não está conectado agora
    pub disponivel: bool,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Sessao {
    pub jogo: String,
    pub inicio: u64,
    pub fim: u64,
    pub duracao_s: u64,
}

#[derive(Debug, Default, Clone, PartialEq, Serialize)]
pub struct ResumoEscaneamento {
    pub encontrados: usize,
    pub novos: usize,
    pub atualizados: usize,
    pub removidos: usize,
    pub ignorados: usize,
    pub pastas_ausentes: Vec<String>,
}

#[derive(Debug, Default, Clone, Copy)]
pub struct OpcoesEscaneamento {
    /// calcula o CRC-32 de cada ROM (mais lento; útil para casar com bancos de dados)
    pub crc32: bool,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "snake_case")]
pub enum Ordem {
    #[default]
    Titulo,
    Recentes,
    MaisJogados,
    Adicionados,
    Ano,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(default)]
pub struct Filtro {
    pub texto: String,
    pub plataforma: Option<String>,
    pub so_favoritos: bool,
    pub incluir_escondidos: bool,
    pub ordem: Ordem,
    pub limite: Option<usize>,
}

#[derive(Debug, Serialize, PartialEq)]
pub struct ResumoPlataforma {
    pub id: String,
    pub nome: String,
    pub tipo: plataformas::Tipo,
    pub total: usize,
}

#[derive(Debug, Serialize, PartialEq)]
pub struct Estatisticas {
    pub jogos: usize,
    pub plataformas: usize,
    pub favoritos: usize,
    pub tempo_total_s: u64,
    pub sessoes: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Biblioteca {
    pub versao: u32,
    pub pastas: Vec<PathBuf>,
    pub jogos: BTreeMap<String, Jogo>,
    pub historico: Vec<Sessao>,
    /// jogos abertos agora: id → início (segundos). Guardado para sobreviver a um fechamento inesperado.
    pub em_andamento: BTreeMap<String, u64>,
}

impl Default for Biblioteca {
    fn default() -> Self {
        Biblioteca { versao: VERSAO, pastas: Vec::new(), jogos: BTreeMap::new(), historico: Vec::new(), em_andamento: BTreeMap::new() }
    }
}

fn caminho_normalizado(p: &Path) -> String {
    p.to_string_lossy().replace('\\', "/").to_lowercase()
}

fn nome_do_arquivo(p: &Path) -> String {
    p.file_name().and_then(|n| n.to_str()).unwrap_or("").to_string()
}

fn oculto(nome: &str) -> bool {
    nome.starts_with('.') || nome.starts_with("~$")
}

fn segundos(m: &fs::Metadata) -> u64 {
    m.modified().ok().and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok()).map(|d| d.as_secs()).unwrap_or(0)
}

/// Nomes de arquivo (minúsculos) citados por uma lista .m3u ou por uma ficha .cue ("FILE \"disco.bin\" BINARY").
fn referencias(arquivo: &Path) -> Vec<String> {
    let Ok(meta) = fs::metadata(arquivo) else { return Vec::new() };
    if meta.len() > 1024 * 1024 {
        return Vec::new();
    }
    let Ok(texto) = fs::read_to_string(arquivo) else { return Vec::new() };
    let eh_cue = plataformas::extensao(arquivo) == "cue";
    let mut v = Vec::new();
    for linha in texto.lines() {
        let l = linha.trim();
        if l.is_empty() || l.starts_with('#') && !eh_cue {
            continue;
        }
        let alvo = if eh_cue {
            let Some(resto) = l.strip_prefix("FILE").or_else(|| l.strip_prefix("file")) else { continue };
            let resto = resto.trim();
            if let Some(s) = resto.strip_prefix('"') {
                s.split('"').next().unwrap_or("").to_string()
            } else {
                resto.split_whitespace().next().unwrap_or("").to_string()
            }
        } else {
            l.to_string()
        };
        if let Some(n) = Path::new(&alvo.replace('\\', "/")).file_name().and_then(|n| n.to_str()) {
            v.push(n.to_lowercase());
        }
    }
    v
}

fn espiar_zip(caminho: &Path) -> Vec<String> {
    let Ok(f) = fs::File::open(caminho) else { return Vec::new() };
    let Ok(mut z) = zip::ZipArchive::new(f) else { return Vec::new() };
    (0..z.len().min(50)).filter_map(|i| z.by_index(i).ok().map(|e| e.name().to_string())).collect()
}

fn melhor_do_grupo(a: &Jogo, b: &Jogo) -> std::cmp::Ordering {
    let marca = |j: &Jogo| j.tags.iter().filter(|t| !t.starts_with("Rev") && !t.starts_with('v') && *t != "verificado").count();
    titulo::ordem_da_regiao(&a.regioes)
        .cmp(&titulo::ordem_da_regiao(&b.regioes))
        .then(marca(a).cmp(&marca(b)))
        .then(b.tags.iter().any(|t| t == "verificado").cmp(&a.tags.iter().any(|t| t == "verificado")))
        .then(b.modificado.cmp(&a.modificado))
        .then(a.caminho.cmp(&b.caminho))
}

impl Biblioteca {
    pub fn carregar(arquivo: &Path) -> Biblioteca {
        let Ok(texto) = fs::read_to_string(arquivo) else { return Biblioteca::default() };
        match serde_json::from_str::<Biblioteca>(&texto) {
            Ok(b) if b.versao <= VERSAO => b,
            _ => {
                // arquivo corrompido ou de versão futura: guarda uma cópia e começa de novo, sem perder o original
                let _ = fs::copy(arquivo, arquivo.with_extension("json.bak"));
                Biblioteca::default()
            }
        }
    }

    /// Grava num arquivo temporário e troca (nunca deixa o arquivo pela metade).
    pub fn salvar(&self, arquivo: &Path) -> Result<(), String> {
        if let Some(pai) = arquivo.parent() {
            fs::create_dir_all(pai).map_err(|e| format!("Não consegui criar a pasta da biblioteca: {e}"))?;
        }
        let tmp = arquivo.with_extension("json.tmp");
        let texto = serde_json::to_string(self).map_err(|e| e.to_string())?;
        fs::write(&tmp, texto).map_err(|e| format!("Não consegui salvar a biblioteca: {e}"))?;
        fs::rename(&tmp, arquivo).map_err(|e| format!("Não consegui salvar a biblioteca: {e}"))
    }

    pub fn adicionar_pasta(&mut self, pasta: &Path) -> Result<(), String> {
        if !pasta.is_dir() {
            return Err(format!("A pasta não existe: {}", pasta.display()));
        }
        if pasta.parent().is_none() {
            return Err("Escolha uma pasta, não a raiz do disco.".into());
        }
        if !self.pastas.iter().any(|p| p == pasta) {
            self.pastas.push(pasta.to_path_buf());
        }
        Ok(())
    }

    /// Tira a pasta da lista e esquece os jogos dela (os arquivos não são tocados).
    pub fn remover_pasta(&mut self, pasta: &Path) -> usize {
        self.pastas.retain(|p| p != pasta);
        let antes = self.jogos.len();
        self.jogos.retain(|_, j| j.raiz != pasta);
        antes - self.jogos.len()
    }

    pub fn escanear(&mut self, agora: u64, opcoes: OpcoesEscaneamento) -> ResumoEscaneamento {
        let mut r = ResumoEscaneamento::default();
        let mut vistos: HashSet<String> = HashSet::new();
        let mut raizes_varridas: Vec<PathBuf> = Vec::new();
        let pastas = self.pastas.clone();
        for raiz in &pastas {
            if !raiz.is_dir() {
                r.pastas_ausentes.push(raiz.display().to_string());
                for j in self.jogos.values_mut().filter(|j| &j.raiz == raiz) {
                    j.disponivel = false;
                }
                continue;
            }
            raizes_varridas.push(raiz.clone());
            self.varrer_raiz(raiz, agora, opcoes, &mut vistos, &mut r);
        }
        let antes = self.jogos.len();
        self.jogos.retain(|id, j| vistos.contains(id) || !raizes_varridas.contains(&j.raiz));
        r.removidos = antes - self.jogos.len();
        for j in self.jogos.values_mut().filter(|j| raizes_varridas.contains(&j.raiz)) {
            j.disponivel = true;
        }
        self.marcar_duplicatas();
        r
    }

    fn varrer_raiz(&mut self, raiz: &Path, agora: u64, opcoes: OpcoesEscaneamento, vistos: &mut HashSet<String>, r: &mut ResumoEscaneamento) {
        // 1) agrupa os arquivos por pasta
        let mut por_pasta: BTreeMap<PathBuf, Vec<(PathBuf, fs::Metadata)>> = BTreeMap::new();
        let it = WalkDir::new(raiz).follow_links(false).max_depth(12).into_iter().filter_entry(|e| {
            if e.depth() == 0 {
                return true;
            }
            let n = e.file_name().to_string_lossy();
            !oculto(&n) && !(e.file_type().is_dir() && IGNORAR_PASTAS.contains(&normalizar(&n).as_str()))
        });
        for e in it.filter_map(Result::ok) {
            if !e.file_type().is_file() {
                continue;
            }
            let Ok(meta) = e.metadata() else { continue };
            por_pasta.entry(e.path().parent().unwrap_or(raiz).to_path_buf()).or_default().push((e.path().to_path_buf(), meta));
        }
        // 2) em cada pasta: o que .m3u e .cue já cobrem não vira jogo à parte; lê o gamelist.xml uma vez
        for (pasta, arquivos) in &por_pasta {
            let mut cobertos: HashSet<String> = HashSet::new();
            for (p, _) in arquivos {
                let ext = plataformas::extensao(p);
                if ext == "m3u" || ext == "cue" {
                    cobertos.extend(referencias(p));
                }
            }
            // um .cue cobre os .bin que cita; um .m3u cobre os discos (inclusive os .cue) que lista
            let mut m3u_cobre: HashSet<String> = HashSet::new();
            for (p, _) in arquivos {
                if plataformas::extensao(p) == "m3u" {
                    m3u_cobre.extend(referencias(p));
                }
            }
            let gamelist = midia::ler_gamelist(pasta);
            for (caminho, meta) in arquivos {
                let nome = nome_do_arquivo(caminho);
                let nome_baixo = nome.to_lowercase();
                let ext = plataformas::extensao(caminho);
                let pl: Option<&'static Plataforma> = match plataformas::identificar(caminho, raiz) {
                    Some(p) => Some(p),
                    None if plataformas::eh_pacote(&ext) => plataformas::identificar_dentro(&espiar_zip(caminho)),
                    None => None,
                };
                let Some(pl) = pl else { continue };
                if ext == "m3u" && pl.extensoes.contains(&"m3u") {
                    // a lista vira o jogo; os discos dela ficam escondidos
                } else if (ext == "bin" || ext == "img" || ext == "mdf" || ext == "iso") && cobertos.contains(&nome_baixo) && plataformas::extensao(caminho) != "m3u" {
                    r.ignorados += 1;
                    continue;
                }
                if m3u_cobre.contains(&nome_baixo) && ext != "m3u" {
                    r.ignorados += 1;
                    continue;
                }
                r.encontrados += 1;
                let id = hash::id_estavel(&format!("{}|{}", pl.id, caminho_normalizado(caminho)));
                vistos.insert(id.clone());
                let bytes = meta.len();
                let modificado = segundos(meta);
                if let Some(j) = self.jogos.get_mut(&id) {
                    if j.bytes == bytes && j.modificado == modificado {
                        j.raiz = raiz.to_path_buf();
                        if j.capa.as_ref().is_none_or(|c| !c.is_file()) {
                            j.capa = gamelist.get(&nome_baixo).and_then(|i| i.capa.clone()).or_else(|| midia::capa_local(caminho, pl));
                        }
                        continue;
                    }
                }
                let anterior = self.jogos.get(&id).cloned();
                let t: Titulo = titulo::analisar(&nome);
                let info: Info = gamelist.get(&nome_baixo).cloned().unwrap_or_default();
                let stem = caminho.file_stem().and_then(|s| s.to_str()).unwrap_or(&nome).to_string();
                let crc = if opcoes.crc32 { hash::crc32_arquivo(caminho, LIMITE_CRC).ok().flatten().map(|c| format!("{c:08x}")) } else { anterior.as_ref().and_then(|a| a.crc32.clone()) };
                let novo = Jogo {
                    id: id.clone(),
                    titulo: info.nome.clone().filter(|n| !n.trim().is_empty()).unwrap_or_else(|| t.nome.clone()),
                    plataforma: pl.id.to_string(),
                    caminho: caminho.clone(),
                    raiz: raiz.to_path_buf(),
                    bytes,
                    modificado,
                    regioes: t.regioes,
                    idiomas: t.idiomas,
                    tags: t.tags,
                    disco: t.disco,
                    grupo: format!("{}|{}", pl.id, t.chave),
                    capa: info.capa.clone().or_else(|| midia::capa_local(caminho, pl)),
                    capa_online: midia::capa_online(pl, &stem),
                    descricao: info.descricao.clone().or_else(|| midia::descricao_local(caminho)),
                    desenvolvedor: info.desenvolvedor,
                    editora: info.editora,
                    ano: info.ano,
                    genero: info.genero,
                    jogadores: info.jogadores,
                    crc32: crc,
                    adicionado: anterior.as_ref().map(|a| a.adicionado).unwrap_or(agora),
                    favorito: anterior.as_ref().is_some_and(|a| a.favorito),
                    ultimo_jogo: anterior.as_ref().map(|a| a.ultimo_jogo).unwrap_or(0),
                    tempo_total_s: anterior.as_ref().map(|a| a.tempo_total_s).unwrap_or(0),
                    sessoes: anterior.as_ref().map(|a| a.sessoes).unwrap_or(0),
                    escondido: false,
                    disponivel: true,
                };
                if anterior.is_some() {
                    r.atualizados += 1;
                } else {
                    r.novos += 1;
                }
                self.jogos.insert(id, novo);
            }
        }
    }

    /// Entre versões do mesmo jogo (EUA/Japão/Beta…) deixa visível só a preferida.
    fn marcar_duplicatas(&mut self) {
        let mut grupos: HashMap<(String, Option<u32>), Vec<String>> = HashMap::new();
        for j in self.jogos.values() {
            grupos.entry((j.grupo.clone(), j.disco)).or_default().push(j.id.clone());
        }
        for (_, ids) in grupos {
            let melhor = ids.iter().filter_map(|i| self.jogos.get(i)).min_by(|a, b| melhor_do_grupo(a, b)).map(|j| j.id.clone());
            for id in &ids {
                if let Some(j) = self.jogos.get_mut(id) {
                    j.escondido = Some(id) != melhor.as_ref();
                }
            }
        }
    }

    pub fn favoritar(&mut self, id: &str, favorito: bool) -> Result<(), String> {
        self.jogos.get_mut(id).map(|j| j.favorito = favorito).ok_or_else(|| "Esse jogo não está mais na biblioteca.".to_string())
    }

    pub fn iniciar_sessao(&mut self, id: &str, agora: u64) -> Result<(), String> {
        if !self.jogos.contains_key(id) {
            return Err("Esse jogo não está mais na biblioteca.".into());
        }
        self.em_andamento.insert(id.to_string(), agora);
        Ok(())
    }

    /// Fecha a sessão aberta e soma o tempo. Devolve a duração registrada (None se não havia sessão ou foi curta demais).
    pub fn encerrar_sessao(&mut self, id: &str, agora: u64) -> Option<u64> {
        let inicio = self.em_andamento.remove(id)?;
        self.registrar_tempo(id, inicio, agora.saturating_sub(inicio))
    }

    /// Registra uma sessão já medida por fora (ex.: o Android avisa quando o emulador fecha).
    pub fn registrar_tempo(&mut self, id: &str, inicio: u64, duracao_s: u64) -> Option<u64> {
        if duracao_s < SESSAO_MINIMA_S {
            return None;
        }
        let d = duracao_s.min(SESSAO_MAXIMA_S);
        let j = self.jogos.get_mut(id)?;
        j.tempo_total_s += d;
        j.sessoes += 1;
        j.ultimo_jogo = inicio + d;
        self.historico.push(Sessao { jogo: id.to_string(), inicio, fim: inicio + d, duracao_s: d });
        if self.historico.len() > LIMITE_HISTORICO {
            let sobra = self.historico.len() - LIMITE_HISTORICO;
            self.historico.drain(..sobra);
        }
        Some(d)
    }

    /// Sessões que ficaram abertas por mais de 24 h (o app fechou sem avisar) são descartadas.
    pub fn limpar_sessoes_velhas(&mut self, agora: u64) {
        self.em_andamento.retain(|_, inicio| agora.saturating_sub(*inicio) <= SESSAO_MAXIMA_S);
    }

    pub fn buscar(&self, f: &Filtro) -> Vec<&Jogo> {
        let texto = normalizar(&f.texto);
        let mut v: Vec<&Jogo> = self
            .jogos
            .values()
            .filter(|j| (f.incluir_escondidos || !j.escondido) && (!f.so_favoritos || j.favorito))
            .filter(|j| f.plataforma.as_ref().is_none_or(|p| &j.plataforma == p))
            .filter(|j| texto.is_empty() || normalizar(&j.titulo).contains(&texto))
            .collect();
        match f.ordem {
            Ordem::Titulo => v.sort_by_key(|j| (normalizar(&j.titulo), j.disco)),
            Ordem::Recentes => v.sort_by(|a, b| b.ultimo_jogo.cmp(&a.ultimo_jogo).then(normalizar(&a.titulo).cmp(&normalizar(&b.titulo)))),
            Ordem::MaisJogados => v.sort_by(|a, b| b.tempo_total_s.cmp(&a.tempo_total_s).then(normalizar(&a.titulo).cmp(&normalizar(&b.titulo)))),
            Ordem::Adicionados => v.sort_by(|a, b| b.adicionado.cmp(&a.adicionado).then(normalizar(&a.titulo).cmp(&normalizar(&b.titulo)))),
            Ordem::Ano => v.sort_by(|a, b| b.ano.cmp(&a.ano).then(normalizar(&a.titulo).cmp(&normalizar(&b.titulo)))),
        }
        if let Some(l) = f.limite {
            v.truncate(l);
        }
        v
    }

    /// "Continuar jogando": os últimos jogos que a pessoa abriu.
    pub fn continuar(&self, n: usize) -> Vec<&Jogo> {
        let mut v: Vec<&Jogo> = self.jogos.values().filter(|j| j.ultimo_jogo > 0 && !j.escondido).collect();
        v.sort_by(|a, b| b.ultimo_jogo.cmp(&a.ultimo_jogo));
        v.truncate(n);
        v
    }

    pub fn plataformas(&self) -> Vec<ResumoPlataforma> {
        let mut c: BTreeMap<&str, usize> = BTreeMap::new();
        for j in self.jogos.values().filter(|j| !j.escondido) {
            *c.entry(j.plataforma.as_str()).or_default() += 1;
        }
        let mut v: Vec<ResumoPlataforma> = c.into_iter().filter_map(|(id, total)| por_id(id).map(|p| ResumoPlataforma { id: id.to_string(), nome: p.nome.to_string(), tipo: p.tipo, total })).collect();
        v.sort_by(|a, b| b.total.cmp(&a.total).then(a.nome.cmp(&b.nome)));
        v
    }

    pub fn estatisticas(&self) -> Estatisticas {
        let visiveis: Vec<&Jogo> = self.jogos.values().filter(|j| !j.escondido).collect();
        Estatisticas {
            jogos: visiveis.len(),
            plataformas: visiveis.iter().map(|j| j.plataforma.as_str()).collect::<HashSet<_>>().len(),
            favoritos: visiveis.iter().filter(|j| j.favorito).count(),
            tempo_total_s: self.jogos.values().map(|j| j.tempo_total_s).sum(),
            sessoes: self.historico.len(),
        }
    }
}

#[cfg(test)]
mod testes {
    use super::*;

    fn arq(base: &Path, rel: &str, conteudo: &str) {
        let p = base.join(rel);
        fs::create_dir_all(p.parent().unwrap()).unwrap();
        fs::write(p, conteudo).unwrap();
    }

    fn montar() -> (tempfile::TempDir, Biblioteca) {
        let t = tempfile::tempdir().unwrap();
        arq(t.path(), "snes/Zelda (USA).sfc", "z");
        arq(t.path(), "snes/Zelda (Japan).sfc", "zj");
        arq(t.path(), "snes/Mario (USA) (Beta).sfc", "m1");
        arq(t.path(), "snes/Mario (USA).sfc", "m2");
        arq(t.path(), "gba/Pokemon.gba", "p");
        arq(t.path(), "psx/Crash (USA).cue", "FILE \"Crash (USA).bin\" BINARY\n  TRACK 01 MODE2/2352\n");
        arq(t.path(), "psx/Crash (USA).bin", "disco");
        arq(t.path(), "psx/FF7 (Disc 1).cue", "FILE \"FF7 (Disc 1).bin\" BINARY");
        arq(t.path(), "psx/FF7 (Disc 1).bin", "d1");
        arq(t.path(), "psx/FF7 (Disc 2).cue", "FILE \"FF7 (Disc 2).bin\" BINARY");
        arq(t.path(), "psx/FF7 (Disc 2).bin", "d2");
        arq(t.path(), "psx/FF7.m3u", "FF7 (Disc 1).cue\nFF7 (Disc 2).cue\n");
        arq(t.path(), "bios/scph1001.bin", "bios");
        arq(t.path(), "snes/media/boxart/lixo.sfc", "nao");
        arq(t.path(), "outros/foto.jpg", "x");
        arq(t.path(), "outros/filme.iso", "x");
        arq(t.path(), "snes/.oculto.sfc", "x");
        let mut b = Biblioteca::default();
        b.adicionar_pasta(t.path()).unwrap();
        (t, b)
    }

    #[test]
    fn escaneia_identifica_e_agrupa() {
        let (_t, mut b) = montar();
        let r = b.escanear(1000, OpcoesEscaneamento::default());
        let titulos: Vec<String> = b.buscar(&Filtro::default()).iter().map(|j| format!("{}:{}", j.plataforma, j.titulo)).collect();
        assert_eq!(titulos, vec!["ps1:Crash", "ps1:FF7", "snes:Mario", "gba:Pokemon", "snes:Zelda"], "{titulos:?}");
        assert_eq!(r.novos, 7, "{r:?}"); // Zelda EUA e JP, Mario e Mario Beta, Pokémon, Crash (.cue) e FF7 (.m3u)
        assert!(r.ignorados >= 4); // bin do Crash, bin dos dois discos, e os cue/disc cobertos pelo m3u
    }

    #[test]
    fn m3u_junta_os_discos_e_cue_cobre_o_bin() {
        let (_t, mut b) = montar();
        b.escanear(1, OpcoesEscaneamento::default());
        let ps1: Vec<&Jogo> = b.jogos.values().filter(|j| j.plataforma == "ps1").collect();
        let nomes: Vec<String> = ps1.iter().map(|j| nome_do_arquivo(&j.caminho)).collect();
        assert!(nomes.contains(&"FF7.m3u".to_string()), "{nomes:?}");
        assert!(nomes.contains(&"Crash (USA).cue".to_string()));
        assert!(!nomes.iter().any(|n| n.ends_with(".bin") || n.contains("Disc")), "{nomes:?}");
    }

    #[test]
    fn esconde_a_versao_menos_preferida() {
        let (_t, mut b) = montar();
        b.escanear(1, OpcoesEscaneamento::default());
        let zelda: Vec<&Jogo> = b.jogos.values().filter(|j| j.titulo == "Zelda").collect();
        assert_eq!(zelda.len(), 2);
        assert!(zelda.iter().find(|j| j.regioes == vec!["EUA"]).is_some_and(|j| !j.escondido));
        assert!(zelda.iter().find(|j| j.regioes == vec!["Japão"]).is_some_and(|j| j.escondido));
        let mario: Vec<&Jogo> = b.jogos.values().filter(|j| j.titulo == "Mario").collect();
        assert!(mario.iter().find(|j| j.tags.is_empty()).is_some_and(|j| !j.escondido));
        assert!(mario.iter().find(|j| j.tags == vec!["Beta"]).is_some_and(|j| j.escondido));
        let com_escondidos = b.buscar(&Filtro { incluir_escondidos: true, ..Default::default() });
        assert_eq!(com_escondidos.len(), b.buscar(&Filtro::default()).len() + 2);
    }

    #[test]
    fn ignora_bios_extras_e_arquivos_que_nao_sao_jogos() {
        let (_t, mut b) = montar();
        b.escanear(1, OpcoesEscaneamento::default());
        let caminhos: Vec<String> = b.jogos.values().map(|j| j.caminho.to_string_lossy().to_string()).collect();
        assert!(!caminhos.iter().any(|c| c.contains("bios") || c.contains("media") || c.contains("outros") || c.contains(".oculto")), "{caminhos:?}");
    }

    #[test]
    fn rescan_preserva_favoritos_e_tempo_e_remove_apagados() {
        let (t, mut b) = montar();
        b.escanear(1000, OpcoesEscaneamento::default());
        let id = b.buscar(&Filtro { texto: "pokemon".into(), ..Default::default() })[0].id.clone();
        b.favoritar(&id, true).unwrap();
        b.iniciar_sessao(&id, 2000).unwrap();
        assert_eq!(b.encerrar_sessao(&id, 2600), Some(600));
        // muda o arquivo (tamanho novo) e apaga outro
        arq(t.path(), "gba/Pokemon.gba", "conteudo maior agora");
        fs::remove_file(t.path().join("snes/Zelda (Japan).sfc")).unwrap();
        let r = b.escanear(5000, OpcoesEscaneamento::default());
        assert_eq!(r.atualizados, 1);
        assert_eq!(r.removidos, 1);
        let j = &b.jogos[&id];
        assert!(j.favorito);
        assert_eq!(j.tempo_total_s, 600);
        assert_eq!(j.adicionado, 1000);
        assert_eq!(j.ultimo_jogo, 2600);
        // escanear de novo sem mudanças não altera nada
        let r2 = b.escanear(9000, OpcoesEscaneamento::default());
        assert_eq!((r2.novos, r2.atualizados, r2.removidos), (0, 0, 0));
    }

    #[test]
    fn pasta_ausente_nao_apaga_os_jogos() {
        let (t, mut b) = montar();
        b.escanear(1, OpcoesEscaneamento::default());
        let total = b.jogos.len();
        let nova = b.pastas[0].clone();
        // simula o disco desconectado: aponta para uma pasta que sumiu
        let fantasma = t.path().join("sumiu");
        for j in b.jogos.values_mut() {
            j.raiz = fantasma.clone();
        }
        b.pastas = vec![fantasma.clone()];
        let r = b.escanear(2, OpcoesEscaneamento::default());
        assert_eq!(b.jogos.len(), total);
        assert_eq!(r.pastas_ausentes.len(), 1);
        assert!(b.jogos.values().all(|j| !j.disponivel));
        b.pastas = vec![nova];
    }

    #[test]
    fn busca_ordena_e_filtra() {
        let (_t, mut b) = montar();
        b.escanear(100, OpcoesEscaneamento::default());
        let snes = b.buscar(&Filtro { plataforma: Some("snes".into()), ..Default::default() });
        assert_eq!(snes.len(), 2);
        assert_eq!(b.buscar(&Filtro { texto: "ZELD".into(), ..Default::default() }).len(), 1);
        assert_eq!(b.buscar(&Filtro { texto: "inexistente".into(), ..Default::default() }).len(), 0);
        assert_eq!(b.buscar(&Filtro { limite: Some(2), ..Default::default() }).len(), 2);
        let id = snes[0].id.clone();
        b.favoritar(&id, true).unwrap();
        assert_eq!(b.buscar(&Filtro { so_favoritos: true, ..Default::default() }).len(), 1);
        assert!(b.favoritar("x", true).is_err());
        let pl = b.plataformas();
        assert_eq!(pl.iter().map(|p| (p.id.as_str(), p.total)).collect::<Vec<_>>(), vec![("ps1", 2), ("snes", 2), ("gba", 1)]);
    }

    #[test]
    fn historico_tempo_e_continuar() {
        let (_t, mut b) = montar();
        b.escanear(1, OpcoesEscaneamento::default());
        let ids: Vec<String> = b.buscar(&Filtro::default()).iter().map(|j| j.id.clone()).collect();
        assert!(b.iniciar_sessao("nada", 1).is_err());
        b.iniciar_sessao(&ids[0], 1000).unwrap();
        assert_eq!(b.encerrar_sessao(&ids[0], 1005), None); // curta demais
        assert_eq!(b.encerrar_sessao(&ids[0], 1100), None); // já não há sessão aberta
        b.iniciar_sessao(&ids[0], 1000).unwrap();
        assert_eq!(b.encerrar_sessao(&ids[0], 4600), Some(3600));
        assert_eq!(b.registrar_tempo(&ids[1], 5000, 100_000), Some(SESSAO_MAXIMA_S)); // limitada a 24 h
        assert_eq!(b.registrar_tempo(&ids[2], 9000, 300), Some(300));
        let c = b.continuar(2);
        assert_eq!(c.len(), 2);
        assert_eq!(c[0].id, ids[1]);
        assert_eq!(c[1].id, ids[2]);
        let mais = b.buscar(&Filtro { ordem: Ordem::MaisJogados, limite: Some(1), ..Default::default() });
        assert_eq!(mais[0].id, ids[1]);
        let e = b.estatisticas();
        assert_eq!(e.sessoes, 3);
        assert_eq!(e.tempo_total_s, 3600 + SESSAO_MAXIMA_S + 300);
        b.iniciar_sessao(&ids[0], 10).unwrap();
        b.limpar_sessoes_velhas(10 + SESSAO_MAXIMA_S + 1);
        assert!(b.em_andamento.is_empty());
    }

    #[test]
    fn historico_tem_limite() {
        let (_t, mut b) = montar();
        b.escanear(1, OpcoesEscaneamento::default());
        let id = b.jogos.keys().next().unwrap().clone();
        for i in 0..(LIMITE_HISTORICO as u64 + 50) {
            b.registrar_tempo(&id, 100 + i * 100, 60);
        }
        assert_eq!(b.historico.len(), LIMITE_HISTORICO);
        assert_eq!(b.jogos[&id].sessoes as usize, LIMITE_HISTORICO + 50);
    }

    #[test]
    fn salva_carrega_e_se_recupera_de_arquivo_corrompido() {
        let (t, mut b) = montar();
        b.escanear(1, OpcoesEscaneamento::default());
        let arquivo = t.path().join("dados/biblioteca.json");
        b.salvar(&arquivo).unwrap();
        assert_eq!(Biblioteca::carregar(&arquivo), b);
        assert!(!arquivo.with_extension("json.tmp").exists());
        fs::write(&arquivo, "{ quebrado").unwrap();
        let nova = Biblioteca::carregar(&arquivo);
        assert!(nova.jogos.is_empty());
        assert!(arquivo.with_extension("json.bak").exists());
        assert!(Biblioteca::carregar(&t.path().join("nao_existe.json")).jogos.is_empty());
    }

    #[test]
    fn capa_descricao_e_crc_entram_no_jogo() {
        let t = tempfile::tempdir().unwrap();
        arq(t.path(), "nes/Contra (USA).nes", "123456789");
        arq(t.path(), "nes/Contra (USA).png", "img");
        arq(t.path(), "nes/Contra (USA).txt", "Atire em tudo.");
        let mut b = Biblioteca::default();
        b.adicionar_pasta(t.path()).unwrap();
        b.escanear(1, OpcoesEscaneamento { crc32: true });
        let j = b.jogos.values().next().unwrap();
        assert_eq!(j.titulo, "Contra");
        assert_eq!(j.crc32.as_deref(), Some("cbf43926"));
        assert_eq!(j.capa, Some(t.path().join("nes/Contra (USA).png")));
        assert_eq!(j.descricao.as_deref(), Some("Atire em tudo."));
        assert!(j.capa_online.as_deref().unwrap().contains("Nintendo%20-%20Nintendo%20Entertainment%20System"));
        assert_eq!(j.regioes, vec!["EUA"]);
    }

    #[test]
    fn zip_com_rom_dentro_e_pasta_invalida() {
        let t = tempfile::tempdir().unwrap();
        {
            use std::io::Write;
            let mut w = zip::ZipWriter::new(fs::File::create(t.path().join("Jogo.zip")).unwrap());
            w.start_file("Jogo (USA).nes", zip::write::SimpleFileOptions::default()).unwrap();
            w.write_all(b"rom").unwrap();
            w.finish().unwrap();
        }
        let mut b = Biblioteca::default();
        b.adicionar_pasta(t.path()).unwrap();
        b.escanear(1, OpcoesEscaneamento::default());
        assert_eq!(b.jogos.values().next().map(|j| j.plataforma.as_str()), Some("nes"));
        assert!(b.adicionar_pasta(&t.path().join("nao")).is_err());
        assert!(b.adicionar_pasta(Path::new("/")).is_err());
        assert_eq!(b.remover_pasta(t.path()), 1);
        assert!(b.jogos.is_empty() && b.pastas.is_empty());
    }
}

//! Do nome do arquivo ao título do jogo: tira região, idioma, revisão e marcas de dump
//! ("Legend of Zelda, The - A Link to the Past (USA) (Rev A) [!].sfc" → "The Legend of Zelda - A Link to the Past").
use crate::plataformas::normalizar;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Default)]
pub struct Titulo {
    pub nome: String,
    pub regioes: Vec<String>,
    pub idiomas: Vec<String>,
    pub tags: Vec<String>,
    /// "Disc 2" → Some(2)
    pub disco: Option<u32>,
    /// chave de agrupamento: o mesmo jogo em regiões/revisões diferentes tem a mesma chave
    pub chave: String,
}

const REGIOES: &[(&str, &str)] = &[
    ("usa", "EUA"), ("u", "EUA"), ("us", "EUA"), ("europe", "Europa"), ("e", "Europa"), ("eur", "Europa"), ("japan", "Japão"), ("j", "Japão"), ("jpn", "Japão"),
    ("brazil", "Brasil"), ("br", "Brasil"), ("world", "Mundo"), ("w", "Mundo"), ("korea", "Coreia"), ("k", "Coreia"), ("asia", "Ásia"), ("a", "Austrália"), ("australia", "Austrália"),
    ("spain", "Espanha"), ("france", "França"), ("germany", "Alemanha"), ("italy", "Itália"), ("netherlands", "Holanda"), ("sweden", "Suécia"), ("china", "China"),
    ("taiwan", "Taiwan"), ("russia", "Rússia"), ("canada", "Canadá"), ("portugal", "Portugal"), ("uk", "Reino Unido"), ("hong kong", "Hong Kong"),
];
const IDIOMAS: &[&str] = &["en", "pt", "ptbr", "pt-br", "es", "fr", "de", "it", "ja", "ko", "zh", "nl", "sv", "ru", "da", "no", "fi", "pl"];
const ARTIGOS: &[&str] = &["The", "A", "An", "O", "Os", "As", "Le", "La", "Les", "El", "Los", "Las", "Der", "Die", "Das", "Il"];

fn regiao_de(token: &str) -> Option<&'static str> {
    let t = token.trim().to_lowercase();
    REGIOES.iter().find(|(k, _)| *k == t).map(|(_, v)| *v)
}

/// "Disc 2", "Disk 1 of 3", "CD2" → número do disco.
fn disco_de(token: &str) -> Option<u32> {
    let t = token.trim().to_lowercase();
    let resto = ["disc", "disk", "cd"].iter().find_map(|p| t.strip_prefix(p))?;
    resto.trim().split(|c: char| !c.is_ascii_digit()).find(|x| !x.is_empty())?.parse().ok()
}

fn tag_de_colchetes(token: &str) -> Option<&'static str> {
    let t = token.trim().to_lowercase();
    match t.as_str() {
        "!" => Some("verificado"),
        _ if t.starts_with('b') && t[1..].chars().all(|c| c.is_ascii_digit()) && t.len() > 1 => Some("dump ruim"),
        _ if t.starts_with('h') && t.len() > 1 && t[1..].chars().next().is_some_and(|c| c.is_ascii_digit()) => Some("hack"),
        _ if t.starts_with('t') && t.len() > 1 && t[1..].chars().next().is_some_and(|c| c == '+' || c == '-') => Some("tradução"),
        _ if t.starts_with('f') && t.len() > 1 && t[1..].chars().all(|c| c.is_ascii_digit()) => Some("corrigido"),
        _ if t.starts_with('o') && t.len() > 1 && t[1..].chars().all(|c| c.is_ascii_digit()) => Some("overdump"),
        _ => None,
    }
}

fn classificar(token: &str, t: &mut Titulo) {
    let baixo = token.trim().to_lowercase();
    if let Some(n) = disco_de(token) {
        t.disco = Some(n);
        return;
    }
    let partes: Vec<&str> = token.split(',').map(str::trim).filter(|p| !p.is_empty()).collect();
    if !partes.is_empty() && partes.iter().all(|p| regiao_de(p).is_some()) {
        for p in partes {
            let r = regiao_de(p).unwrap().to_string();
            if !t.regioes.contains(&r) {
                t.regioes.push(r);
            }
        }
        return;
    }
    if !partes.is_empty() && partes.iter().all(|p| IDIOMAS.contains(&p.to_lowercase().as_str())) {
        for p in partes {
            let i = p.to_lowercase();
            if !t.idiomas.contains(&i) {
                t.idiomas.push(i);
            }
        }
        return;
    }
    let marca = if baixo.starts_with("rev") || (baixo.starts_with('v') && baixo[1..].starts_with(|c: char| c.is_ascii_digit())) {
        Some(token.trim().to_string())
    } else if baixo.starts_with("beta") || baixo.starts_with("proto") || baixo.starts_with("demo") || baixo.starts_with("sample") || baixo.starts_with("unl") || baixo.starts_with("hack") || baixo.starts_with("pirate") || baixo.starts_with("alt") || baixo.starts_with("kiosk") {
        Some(token.trim().to_string())
    } else {
        None
    };
    if let Some(m) = marca {
        if !t.tags.contains(&m) {
            t.tags.push(m);
        }
    }
}

/// ", The" no fim vira "The" no começo (também antes de " - subtítulo").
fn desinverter(nome: &str) -> String {
    let (principal, resto) = match nome.find(" - ") {
        Some(i) => (&nome[..i], &nome[i..]),
        None => (nome, ""),
    };
    if let Some(i) = principal.rfind(", ") {
        let art = &principal[i + 2..];
        if ARTIGOS.contains(&art) {
            return format!("{art} {}{resto}", &principal[..i]);
        }
    }
    nome.to_string()
}

pub fn analisar(nome_do_arquivo: &str) -> Titulo {
    let stem = match nome_do_arquivo.rfind('.') {
        Some(i) if i > 0 && nome_do_arquivo.len() - i <= 6 => &nome_do_arquivo[..i],
        _ => nome_do_arquivo,
    };
    let mut t = Titulo::default();
    let mut limpo = String::new();
    let mut profundidade = 0;
    let mut abre = ' ';
    let mut token = String::new();
    for c in stem.chars() {
        match c {
            '(' | '[' if profundidade == 0 => {
                profundidade = 1;
                abre = c;
                token.clear();
            }
            ')' | ']' if profundidade == 1 && ((c == ')' && abre == '(') || (c == ']' && abre == '[')) => {
                profundidade = 0;
                if abre == '[' {
                    if let Some(tag) = tag_de_colchetes(&token) {
                        if !t.tags.iter().any(|x| x == tag) {
                            t.tags.push(tag.to_string());
                        }
                    }
                } else {
                    classificar(&token, &mut t);
                }
            }
            _ if profundidade == 1 => token.push(c),
            _ => limpo.push(c),
        }
    }
    if profundidade == 1 {
        limpo.push_str(&token); // parêntese sem fechar: mantém o texto
    }
    let mut nome = if limpo.contains(' ') { limpo } else { limpo.replace('_', " ") };
    nome = nome.split_whitespace().collect::<Vec<_>>().join(" ");
    nome = nome.trim_matches(|c: char| c == '-' || c == ' ' || c == '.').to_string();
    if nome.is_empty() {
        nome = stem.to_string();
    }
    t.nome = desinverter(&nome);
    t.chave = normalizar(&t.nome);
    t
}

/// Quanto menor, mais preferida a região ao esconder duplicatas (Brasil, EUA, Mundo, Europa, Japão…).
pub fn ordem_da_regiao(regioes: &[String]) -> u32 {
    let ordem = ["Brasil", "EUA", "Mundo", "Europa", "Reino Unido", "Japão"];
    regioes.iter().filter_map(|r| ordem.iter().position(|o| o == r)).min().map(|p| p as u32).unwrap_or(50)
}

#[cfg(test)]
mod testes {
    use super::*;

    #[test]
    fn nome_no_intro_completo() {
        let t = analisar("Legend of Zelda, The - A Link to the Past (USA) (Rev A).sfc");
        assert_eq!(t.nome, "The Legend of Zelda - A Link to the Past");
        assert_eq!(t.regioes, vec!["EUA"]);
        assert_eq!(t.tags, vec!["Rev A"]);
        assert_eq!(t.chave, "thelegendofzeldaalinktothepast");
    }

    #[test]
    fn varias_regioes_idiomas_e_disco() {
        let t = analisar("Final Fantasy VII (Europe, Brazil) (En,Fr,De) (Disc 2).chd");
        assert_eq!(t.nome, "Final Fantasy VII");
        assert_eq!(t.regioes, vec!["Europa", "Brasil"]);
        assert_eq!(t.idiomas, vec!["en", "fr", "de"]);
        assert_eq!(t.disco, Some(2));
        assert_eq!(analisar("Jogo (Disk 1 of 3).adf").disco, Some(1));
    }

    #[test]
    fn marcas_de_goodtools() {
        let t = analisar("Super Mario World [!].smc");
        assert_eq!(t.tags, vec!["verificado"]);
        assert_eq!(analisar("Jogo [b1].nes").tags, vec!["dump ruim"]);
        assert_eq!(analisar("Jogo [h2].nes").tags, vec!["hack"]);
        assert_eq!(analisar("Jogo [T+Port].nes").tags, vec!["tradução"]);
    }

    #[test]
    fn nome_simples_e_sublinhados() {
        assert_eq!(analisar("Sonic.md").nome, "Sonic");
        assert_eq!(analisar("Mega_Man_X.sfc").nome, "Mega Man X");
        assert_eq!(analisar("Donkey Kong Country 2 - Diddy's Kong Quest (Beta).sfc").tags, vec!["Beta"]);
        assert_eq!(analisar("(USA).nes").nome, "(USA)"); // só tinha marcas: cai no nome do arquivo
    }

    #[test]
    fn nome_com_ponto_no_meio_e_sem_extensao() {
        assert_eq!(analisar("Dr. Mario (World).nes").nome, "Dr. Mario");
        assert_eq!(analisar("Pasta").nome, "Pasta");
        assert_eq!(analisar("Jogo (USA").nome, "Jogo USA");
    }

    #[test]
    fn mesmo_jogo_em_regioes_diferentes_tem_a_mesma_chave() {
        assert_eq!(analisar("Contra (USA).nes").chave, analisar("Contra (Japan).nes").chave);
        assert_ne!(analisar("Contra (USA).nes").chave, analisar("Super Contra (USA).nes").chave);
    }

    #[test]
    fn ordem_das_regioes() {
        assert!(ordem_da_regiao(&["Brasil".into()]) < ordem_da_regiao(&["EUA".into()]));
        assert!(ordem_da_regiao(&["EUA".into()]) < ordem_da_regiao(&["Japão".into()]));
        assert_eq!(ordem_da_regiao(&[]), 50);
    }
}

//! Hashes simples e estáveis (sem dependências): CRC-32 (para casar com bancos de ROMs) e FNV-1a de 64 bits (para ids).
use std::fs::File;
use std::io::{self, Read};
use std::path::Path;

fn tabela() -> [u32; 256] {
    let mut t = [0u32; 256];
    for i in 0..256u32 {
        let mut c = i;
        for _ in 0..8 {
            c = if c & 1 != 0 { 0xEDB8_8320 ^ (c >> 1) } else { c >> 1 };
        }
        t[i as usize] = c;
    }
    t
}

/// CRC-32 (o mesmo dos bancos No-Intro/Redump) de um trecho de bytes.
pub fn crc32(dados: &[u8]) -> u32 {
    let t = tabela();
    let mut c = 0xFFFF_FFFFu32;
    for b in dados {
        c = t[((c ^ *b as u32) & 0xFF) as usize] ^ (c >> 8);
    }
    c ^ 0xFFFF_FFFF
}

/// CRC-32 de um arquivo inteiro, lendo aos poucos. `limite` protege contra arquivos gigantes (discos): acima dele devolve None.
pub fn crc32_arquivo(caminho: &Path, limite: u64) -> io::Result<Option<u32>> {
    let mut f = File::open(caminho)?;
    if f.metadata()?.len() > limite {
        return Ok(None);
    }
    let t = tabela();
    let mut c = 0xFFFF_FFFFu32;
    let mut buf = vec![0u8; 256 * 1024];
    loop {
        let n = f.read(&mut buf)?;
        if n == 0 {
            break;
        }
        for b in &buf[..n] {
            c = t[((c ^ *b as u32) & 0xFF) as usize] ^ (c >> 8);
        }
    }
    Ok(Some(c ^ 0xFFFF_FFFF))
}

/// FNV-1a de 64 bits em hexadecimal: id curto e estável de um jogo (plataforma + caminho).
pub fn id_estavel(texto: &str) -> String {
    let mut h: u64 = 0xcbf2_9ce4_8422_2325;
    for b in texto.as_bytes() {
        h ^= *b as u64;
        h = h.wrapping_mul(0x0000_0100_0000_01b3);
    }
    format!("{h:016x}")
}

#[cfg(test)]
mod testes {
    use super::*;

    #[test]
    fn crc32_conhecido() {
        assert_eq!(crc32(b"123456789"), 0xCBF4_3926);
        assert_eq!(crc32(b""), 0);
    }

    #[test]
    fn crc32_de_arquivo_e_limite() {
        let t = tempfile::tempdir().unwrap();
        let p = t.path().join("a.bin");
        std::fs::write(&p, b"123456789").unwrap();
        assert_eq!(crc32_arquivo(&p, 1024).unwrap(), Some(0xCBF4_3926));
        assert_eq!(crc32_arquivo(&p, 3).unwrap(), None);
    }

    #[test]
    fn id_e_estavel_e_diferente() {
        assert_eq!(id_estavel("nes|/x/a.nes"), id_estavel("nes|/x/a.nes"));
        assert_ne!(id_estavel("nes|/x/a.nes"), id_estavel("snes|/x/a.nes"));
        assert_eq!(id_estavel("").len(), 16);
    }
}

// Pacotes de emojis prontos do teclado do Voxix, mais os "recentes" guardados no aparelho.
export interface Pacote { id: string; nome: string; icone: string; itens: string[] }

const lista = (s: string): string[] => Array.from(new Set(s.split(/\s+/).filter(Boolean)));

export const PACOTES: Pacote[] = [
  { id: "rostos", nome: "Rostos", icone: "😀", itens: lista("😀 😃 😄 😁 😆 😅 😂 🤣 🙂 😉 😊 😇 🥰 😍 🤩 😘 😋 😛 😜 🤪 😎 🤓 🥳 🤠 😏 😒 😔 😴 🥱 🤔 🤨 😐 😑 😶 🙄 😬 😮 😲 😳 🥺 😢 😭 😤 😠 😡 🤬 🤯 😱 😨 😰 🥵 🥶 🤢 🤮 🤧 😷 🤒 🤕 😈 👿 💀 ☠️ 👻 👽 🤖 💩") },
  { id: "gamer", nome: "Gamer", icone: "🎮", itens: lista("🎮 🕹️ 👾 🎯 🏆 🥇 🥈 🥉 🏅 ⚔️ 🗡️ 🛡️ 🏹 💣 🧨 🔫 💥 🔥 ⚡ 💎 👑 🎲 ♟️ 🧩 🎧 🎤 🎙️ 🖥️ 💻 ⌨️ 🖱️ 📺 🔊 🔇 📡 🚀 🛸 🧙 🧛 🧟 🧞 🥷 🦸 🦹 🐉 🦄 ⭐ 🌟 ✨ 💯 🆙 🆗 🆒 🔴 🟣 🟢 🔵 ❤️‍🔥 🎰 🃏 🀄") },
  { id: "reacoes", nome: "Reações", icone: "👍", itens: lista("👍 👎 👏 🙌 👊 ✊ 🤝 🙏 💪 🤞 ✌️ 🤟 🤘 👌 🤌 👋 🤙 ☝️ 👇 👈 👉 ❤️ 🧡 💛 💚 💙 💜 🖤 🤍 💔 ❣️ 💕 💞 💓 💗 💖 💘 💝 🎉 🎊 🥂 🍻 😂 🤣 💀 🫡 🫶 🫠 🤡 😈 🫣 👀 🧠 ✅ ❌ ⚠️ ❓ ❗ 💬 💤") },
  { id: "animais", nome: "Animais", icone: "🐶", itens: lista("🐶 🐱 🐭 🐹 🐰 🦊 🐻 🐼 🐨 🐯 🦁 🐮 🐷 🐸 🐵 🙈 🙉 🙊 🐔 🐧 🐦 🦅 🦉 🦇 🐺 🐗 🐴 🦄 🐝 🦋 🐌 🐞 🐢 🐍 🦎 🐙 🦑 🦀 🐠 🐬 🐳 🦈 🐊 🦖 🦕 🐉 🦂 🕷️") },
  { id: "comida", nome: "Comida", icone: "🍕", itens: lista("🍕 🍔 🍟 🌭 🥪 🌮 🌯 🍗 🍖 🥓 🍳 🥞 🧇 🍞 🧀 🥗 🍝 🍜 🍣 🍱 🍙 🍦 🍩 🍪 🎂 🍰 🍫 🍬 🍿 🍎 🍌 🍇 🍓 🍉 🍍 🥑 🌽 🥕 🍺 🍷 🥤 ☕ 🧃 🍹 🧋") },
  { id: "esportes", nome: "Esportes", icone: "⚽", itens: lista("⚽ 🏀 🏈 ⚾ 🎾 🏐 🏉 🎱 🏓 🏸 🥊 🥋 ⛳ 🏹 🎣 🛹 🛼 🏂 🏄 🏊 🚴 🏋️ 🤸 🏎️ 🏍️ 🚗 🚁 ✈️ 🚀 🏁 🥅 🎳") },
  { id: "simbolos", nome: "Símbolos", icone: "💯", itens: lista("💯 ✔️ ✖️ ➕ ➖ ➗ ➡️ ⬅️ ⬆️ ⬇️ 🔝 🔙 🔜 🔛 ♾️ ‼️ ⁉️ 🔔 🔕 💡 🔑 🔒 🔓 📌 📎 ✏️ 📷 🎬 🎵 🎶 🌈 ☀️ 🌙 ⭐ ☁️ ⛈️ ❄️ 🔥 💧 🌊 🍀 🌸") },
];

export const RECENTES_ID = "recentes";
const CHAVE = "voxix.emojis.recentes";
export const MAX_RECENTES = 24;

/** Põe o emoji na frente da lista de recentes, sem repetir e sem passar do limite. */
export function somarRecente(lista: string[], emoji: string, max: number = MAX_RECENTES): string[] {
  return [emoji, ...lista.filter((e) => e !== emoji)].slice(0, max);
}
export function lerRecentes(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(CHAVE) ?? "[]");
    return Array.isArray(v) ? v.filter((e): e is string => typeof e === "string" && e.length > 0 && e.length <= 16).slice(0, MAX_RECENTES) : [];
  } catch { return []; }
}
export function guardarRecentes(l: string[]) { try { localStorage.setItem(CHAVE, JSON.stringify(l.slice(0, MAX_RECENTES))); } catch { /* sem armazenamento */ } }

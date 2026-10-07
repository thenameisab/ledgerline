/**
 * Curated profile-avatar emoji set. A fixed palette (rather than a free native
 * picker) keeps avatars legible at 28px, renders consistently across OSes, and
 * is validated server-side so only known values reach the DB.
 *
 * Shared by the picker (ProfileModal) and the API validator.
 */

export const PROFILE_EMOJIS = [
  "🦊", "🐼", "🦉", "🦁", "🐬", "🦅", "🐯", "🦋",
  "🌿", "🌺", "🍀", "🔥", "⭐", "🌙", "⚡", "🌈",
  "📊", "📈", "🧮", "💡", "🔭", "🧭", "🎯", "🗂️",
  "☕", "🎧", "🚀", "🛠️", "🧩", "♟️", "🎨", "🏔️",
] as const;

export type ProfileEmoji = (typeof PROFILE_EMOJIS)[number];

export function isValidProfileEmoji(value: unknown): value is ProfileEmoji {
  return typeof value === "string" && (PROFILE_EMOJIS as readonly string[]).includes(value);
}

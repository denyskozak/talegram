export const GLOBAL_CATEGORIES = ["book", "article", "comics"] as const;

export type GlobalCategory = (typeof GLOBAL_CATEGORIES)[number];

export function isGlobalCategory(value: unknown): value is GlobalCategory {
  return typeof value === "string" && GLOBAL_CATEGORIES.includes(value as GlobalCategory);
}

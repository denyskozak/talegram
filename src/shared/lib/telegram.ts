export function normalizeTelegramUsername(
  value: string | null | undefined,
): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return undefined;
  }

  const prefixed = trimmed.startsWith("@") ? trimmed : `@${trimmed}`;
  return prefixed.toLowerCase();
}

export function getAllowedTelegramVoterUsernames(
  baseUsernames: readonly string[] = [],
): Set<string> {
  const allowed = new Set<string>();

  baseUsernames.forEach((username) => {
    const normalized = normalizeTelegramUsername(username);
    if (normalized) {
      allowed.add(normalized);
    }
  });

  const raw = import.meta.env.VITE_ALLOWED_TELEGRAM_USERNAMES;
  if (typeof raw === "string" && raw.length > 0) {
    raw
      .split(",")
      .map((username) => normalizeTelegramUsername(username))
      .forEach((username) => {
        if (username) {
          allowed.add(username);
        }
      });
  }

  return allowed;
}

export function getTelegramUserId(
  value: unknown,
): string | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value.toString(10);
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }

  return undefined;
}

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

type MiniAppMode = "compact" | "fullscreen";

function normalizeMiniAppShortName(value: string | null | undefined): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function resolveMiniAppMode(value: unknown): MiniAppMode | undefined {
  if (value === "compact" || value === "fullscreen") {
    return value;
  }

  return undefined;
}

type BuildMiniAppDirectLinkOptions = {
  botUsername?: string | null;
  shortName?: string | null;
  startParam?: string | null;
  mode?: MiniAppMode | null;
};

export function buildMiniAppDirectLink(
  options: BuildMiniAppDirectLinkOptions = {},
): string | undefined {

  const url = new URL(`https://t.me/${options.botUsername}?startapp=${options.startParam}?mode=${options.mode ?? "fullscreen"}`);

  const startParam = normalizeMiniAppShortName(options.startParam);
  if (startParam) {
    url.searchParams.set("startapp", startParam);
  }

  const mode = resolveMiniAppMode(options.mode ?? import.meta.env.VITE_TG_APP_MODE);
  if (mode) {
    url.searchParams.set("mode", mode);
  }

  return url.toString();
}

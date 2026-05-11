const LOCAL_ORIGIN = "https://lead-qualifier.local";

export function safeRedirectPath(
  value: string | null | undefined,
  fallback = "/",
): string {
  const fallbackPath = normalizePath(fallback) ?? "/";
  return normalizePath(value) ?? fallbackPath;
}

function normalizePath(value: string | null | undefined): string | null {
  if (!value) return null;

  const raw = value.trim();
  if (
    raw.length === 0 ||
    !raw.startsWith("/") ||
    raw.startsWith("//") ||
    raw.startsWith("/\\") ||
    /[\u0000-\u001F\u007F]/.test(raw)
  ) {
    return null;
  }

  try {
    const url = new URL(raw, LOCAL_ORIGIN);
    if (url.origin !== LOCAL_ORIGIN) return null;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return null;
  }
}

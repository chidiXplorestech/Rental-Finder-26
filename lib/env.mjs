export function envValue(name, fallback="") {
  try {
    const value=globalThis.Netlify?.env?.get?.(name);
    if (value !== undefined && value !== null) return value;
  } catch {}
  return process.env[name] ?? fallback;
}

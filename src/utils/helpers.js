export function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function getIngredientQualityKey(ingredient) {
  return ingredient?.slot ?? ingredient?.name ?? "?";
}

export function clampQuality(value) {
  return Math.max(0, Math.min(1000, toNumber(value, 500)));
}

export function fmtNumber(value) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(toNumber(value));
}

export function fmtMoney(value) {
  return `${fmtNumber(value)} aUEC`;
}

export function fmtSeconds(value) {
  const totalSeconds = Math.max(0, toNumber(value));
  if (!totalSeconds) return "0s";

  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  if (!minutes) return `${seconds}s`;
  if (!seconds) return `${minutes}m`;
  return `${minutes}m ${seconds}s`;
}

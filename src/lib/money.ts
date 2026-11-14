export function formatMoney(cents: number): string {
  const whole = cents % 100 === 0;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: whole ? 0 : 2,
  }).format(cents / 100);
}

export function dollarsToCents(input: string): number {
  const value = Number(input);
  if (!Number.isFinite(value)) return Number.NaN;
  return Math.round(value * 100);
}

export function centsToDollarInput(cents: number): string {
  return (cents / 100).toFixed(cents % 100 === 0 ? 0 : 2);
}

export function formatPercent(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? `${rounded}%` : `${rounded.toFixed(1)}%`;
}

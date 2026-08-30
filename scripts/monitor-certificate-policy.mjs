export const CERTIFICATE_WARNING_DAYS = 21;
export const CERTIFICATE_CRITICAL_DAYS = 14;

export function classifyCertificateLifetime(daysRemaining, {
  warningDays = CERTIFICATE_WARNING_DAYS,
  criticalDays = CERTIFICATE_CRITICAL_DAYS,
} = {}) {
  const values = [daysRemaining, warningDays, criticalDays].map(Number);
  if (!values.every(Number.isFinite)) throw new TypeError("certificate policy values must be finite numbers");
  const [days, warning, critical] = values;
  if (warning <= critical) throw new RangeError("certificate warning days must be greater than critical days");
  if (days < critical) return "critical";
  if (days < warning) return "warning";
  return "ok";
}

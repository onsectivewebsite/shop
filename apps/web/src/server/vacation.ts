/**
 * Pure-function check on whether a seller is *currently* on vacation.
 * vacationMode is the seller-set flag; vacationUntil acts as a self-expiry
 * — if the seller forgot to flip the toggle off when they got back, the
 * UI silently treats it as off so listings come back online automatically.
 *
 * No DB write happens at expiry — the row stays {vacationMode: true,
 * vacationUntil: <past>} until the seller explicitly clears it. This keeps
 * the read path side-effect-free and avoids surprising sellers whose
 * "I'm back" date slipped.
 */
export function isOnVacation(seller: {
  vacationMode: boolean;
  vacationUntil: Date | null;
}): boolean {
  if (!seller.vacationMode) return false;
  if (seller.vacationUntil && seller.vacationUntil <= new Date()) return false;
  return true;
}

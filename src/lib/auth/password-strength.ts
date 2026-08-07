/**
 * Password strength scoring, 0–4.
 *
 * Deliberately in its own module with no `server-only` marker: the signup and
 * change-password forms render the meter in the browser, and the API validates
 * the same password on the server. Both sides import from here.
 */
export function passwordStrength(value: string) {
  let score = 0;
  if (value.length >= 8) score++;
  if (value.length >= 12) score++;
  if (/[a-z]/.test(value) && /[A-Z]/.test(value)) score++;
  if (/\d/.test(value)) score++;
  if (/[^\w\s]/.test(value)) score++;
  return Math.min(4, score);
}

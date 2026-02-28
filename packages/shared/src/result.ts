/**
 * Result type -- a discriminated union for explicit error handling.
 * Avoids throwing exceptions for expected failure cases.
 */
export type Result<T, E = Error> =
  | { ok: true; value: T }
  | { ok: false; error: E };

/** Create a successful Result */
export function ok<T>(value: T): Result<T, never> {
  return { ok: true, value };
}

/** Create a failed Result */
export function err<E>(error: E): Result<never, E> {
  return { ok: false, error };
}

/**
 * Helpers for the shapes `scValToNative` produces for Soroban `contracttype`
 * values.
 */

/**
 * Unit-variant enums (`VaultState`, `VaultType`) decode either to a bare string
 * or to a single-element tuple depending on SDK version — normalise both.
 */
export function parseEnum<T extends string>(value: unknown): T {
  if (typeof value === "string") return value as T;
  if (Array.isArray(value) && typeof value[0] === "string") return value[0] as T;
  if (value && typeof value === "object") {
    const keys = Object.keys(value as Record<string, unknown>);
    if (keys.length === 1) return keys[0] as T;
  }
  throw new Error(`Unrecognised enum value: ${JSON.stringify(value)}`);
}

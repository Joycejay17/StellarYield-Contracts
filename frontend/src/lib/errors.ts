/**
 * Human-readable messages for `single_rwa_vault::errors::Error` and
 * `vault_factory::errors::Error` codes. Soroban surfaces these as
 * `Error(Contract, #N)` inside simulation/transaction failures.
 */
const VAULT_ERRORS: Record<number, string> = {
  1: "This address has not passed KYC for the vault's zkMe verifier.",
  3: "Caller is not an operator on this vault.",
  4: "Caller is not the vault admin.",
  5: "The vault is not in a state that allows this action.",
  6: "Amount is below the vault's minimum deposit.",
  7: "Amount would exceed the per-user deposit cap.",
  8: "The vault has not matured yet.",
  9: "There is no yield available to claim.",
  10: "The funding target has not been met yet.",
  11: "The vault is paused.",
  12: "Invalid (zero) address.",
  13: "Amount must be greater than zero.",
  14: "This address is blacklisted on the vault.",
  15: "Reentrant call detected.",
  16: "The funding deadline has already passed.",
  17: "The funding deadline has not passed yet.",
  18: "No shares available to refund.",
  19: "Share allowance is too low for this transfer.",
  20: "Insufficient balance.",
  21: "This request has already been processed.",
  22: "The requested fee exceeds the permitted maximum.",
  24: "That redemption request does not exist.",
  25: "Operation not supported.",
  26: "Invalid initialization parameters.",
  27: "The vault still holds shares and cannot be closed.",
  28: "Invalid epoch range.",
  29: "The vault is not in an emergency state.",
  30: "Emergency distribution already claimed.",
  31: "The vault requires migration before use.",
  32: "Claim your pending yield before burning shares.",
  33: "Invalid deposit limits.",
  46: "Deposit would push the vault past its funding target.",
  47: "Amount is too small to mint any shares.",
  48: "Share amount converts to zero assets.",
  50: "Cannot distribute yield while the vault has no shareholders.",
};

/** Extract `#N` from a Soroban `Error(Contract, #N)` string. */
function extractContractCode(message: string): number | undefined {
  const match = message.match(/Error\(Contract,\s*#(\d+)\)/);
  return match ? Number(match[1]) : undefined;
}

/**
 * Turn any thrown value from a simulate/sign/send flow into a message worth
 * showing a user. Falls back to the raw text when the shape is unfamiliar.
 */
export function describeError(err: unknown): string {
  const raw =
    err instanceof Error ? err.message : typeof err === "string" ? err : String(err);

  // Text-based checks run FIRST. Contract error codes are per-contract, so the
  // numeric table below is only meaningful for the vault and factory — a token
  // contract reusing #13 for "trustline missing" must not be reported as the
  // vault's ZeroAmount.
  if (/trustline entry is missing|no trustline|trustline/i.test(raw)) {
    return "This account has no trustline for the vault's asset. Add the asset in your wallet before depositing.";
  }
  if (/User declined|denied|rejected/i.test(raw)) {
    return "Transaction was declined in the wallet.";
  }
  if (/Freighter is not|not connected|not installed/i.test(raw)) {
    return "Freighter wallet is not available. Install it and reload the page.";
  }
  if (/txInsufficientBalance|insufficient balance/i.test(raw)) {
    return "Account balance is too low to cover this transaction.";
  }
  if (/account not found|MissingValue/i.test(raw)) {
    return "Account not found on this network. Fund it with the friendbot first.";
  }

  const code = extractContractCode(raw);
  if (code !== undefined) {
    return VAULT_ERRORS[code] ?? `Contract rejected the call (error #${code}).`;
  }

  // Simulation errors are often long multi-line diagnostics; keep the first line.
  return raw.split("\n")[0].slice(0, 240);
}

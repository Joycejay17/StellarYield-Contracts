/**
 * XDR-encoded Soroban contract error code translation table.
 *
 * Raw RPC simulation errors embed numeric error codes that are opaque to end
 * users. This module maps known codes to human-readable metadata so the
 * frontend can display actionable feedback.
 */

export interface ErrorTranslation {
  code: number;
  name: string;
  description: string;
  suggestedAction: string;
}

const UNKNOWN_TRANSLATION: Omit<ErrorTranslation, "code"> = {
  name: "UnknownError",
  description: "An unexpected contract error occurred. The vault may be in an incompatible state for the requested operation.",
  suggestedAction: "Please try again later or contact support if the issue persists.",
};

/**
 * Known Soroban vault contract error codes.
 *
 * The numeric values match the `require` / `panic!` codes emitted by the
 * Rust contract compiled to WASM. See the `soroban-contracts/` directory for
 * the canonical list.
 */
const ERROR_CODE_MAP: Record<number, Omit<ErrorTranslation, "code">> = {
  10: {
    name: "FundingTargetNotMet",
    description: "The vault has not yet reached its funding target. Deposits are allowed but the vault cannot become Active until the target is met.",
    suggestedAction: "Wait until the vault reaches its funding target before attempting this operation.",
  },
  11: {
    name: "FundingTargetExceeded",
    description: "The deposit would cause the vault's total assets to exceed its funding target.",
    suggestedAction: "Reduce the deposit amount or wait for the vault to transition to Active state.",
  },
  12: {
    name: "VaultNotActive",
    description: "The requested operation requires the vault to be in the Active state.",
    suggestedAction: "Check the vault's current state and ensure it is Active before retrying.",
  },
  13: {
    name: "VaultIsPaused",
    description: "The vault is currently paused by its operator. No operations are permitted while paused.",
    suggestedAction: "Wait for the operator to unpause the vault.",
  },
  14: {
    name: "InsufficientShares",
    description: "The user does not have enough vault shares to satisfy the requested withdrawal or redemption.",
    suggestedAction: "Check your current share balance and reduce the withdrawal amount.",
  },
  15: {
    name: "BelowMinDeposit",
    description: "The deposit amount is below the vault's minimum deposit requirement.",
    suggestedAction: "Increase the deposit amount to meet the minimum threshold.",
  },
  16: {
    name: "MaxDepositExceeded",
    description: "The deposit would cause the user to exceed the per-user maximum deposit limit.",
    suggestedAction: "Reduce the deposit amount or withdraw some previously deposited assets first.",
  },
  17: {
    name: "KycRequired",
    description: "The user's address has not been KYC-verified by the vault. KYC verification is required for deposits.",
    suggestedAction: "Complete the KYC verification process before attempting to deposit.",
  },
  18: {
    name: "EpochNotDistributed",
    description: "The yield for the current epoch has not yet been distributed by the operator.",
    suggestedAction: "Wait for the operator to distribute the epoch yield before claiming.",
  },
  19: {
    name: "NothingToClaim",
    description: "The user has no pending yield to claim. All eligible yield has already been claimed.",
    suggestedAction: "Check your claimable yield balance before retrying.",
  },
  20: {
    name: "RedemptionNotProcessed",
    description: "The redemption request has not yet been processed by the operator.",
    suggestedAction: "Wait for the operator to process the redemption queue.",
  },
  21: {
    name: "VaultAlreadyMatured",
    description: "The vault has already matured. No new deposits are accepted for matured vaults.",
    suggestedAction: "Redeem your shares if the vault has matured, or choose a different vault.",
  },
  22: {
    name: "VaultAlreadyClosed",
    description: "The vault has been closed. No operations are possible on a closed vault.",
    suggestedAction: "This vault is no longer operational. Please select a different vault.",
  },
  23: {
    name: "OperatorThresholdNotMet",
    description: "The multi-sig operator approval threshold has not been reached for this operation.",
    suggestedAction: "Obtain additional operator approvals before retrying.",
  },
  24: {
    name: "UnauthorizedCaller",
    description: "The caller address is not authorized to perform this operation on the vault.",
    suggestedAction: "Ensure you are calling from an authorized address (operator or vault owner as appropriate).",
  },
  25: {
    name: "InvalidAmount",
    description: "The provided amount is invalid (zero or negative).",
    suggestedAction: "Provide a positive, non-zero amount for the operation.",
  },
  26: {
    name: "SlippageExceeded",
    description: "The operation result exceeded the user's slippage tolerance.",
    suggestedAction: "Increase the slippage tolerance or reduce the operation size.",
  },
  30: {
    name: "FundingDeadlinePassed",
    description: "The vault's funding deadline has passed without reaching the funding target.",
    suggestedAction: "The vault may be cancelled. Check the vault state for details.",
  },
  31: {
    name: "EarlyRedemptionForbidden",
    description: "Early redemption is not allowed before the maturity date for this vault.",
    suggestedAction: "Wait until the vault matures before redeeming your shares.",
  },
  32: {
    name: "ZeroSharesBurn",
    description: "Cannot burn zero shares. Provide a positive share amount.",
    suggestedAction: "Specify a positive number of shares to burn.",
  },
  33: {
    name: "EpochAlreadyDistributed",
    description: "The yield for this epoch has already been distributed.",
    suggestedAction: "This epoch's yield is already accounted for. Move to the next epoch.",
  },
};

/**
 * Translate a numeric Soroban error code into a human-readable description.
 *
 * @param errorCode - The numeric error code from the XDR simulation error.
 * @returns A full `ErrorTranslation` object including the original code.
 */
export function translateErrorCode(errorCode: number): ErrorTranslation {
  const entry = ERROR_CODE_MAP[errorCode];
  if (entry) {
    return { code: errorCode, ...entry };
  }
  return { code: errorCode, ...UNKNOWN_TRANSLATION };
}

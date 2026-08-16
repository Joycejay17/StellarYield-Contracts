import { useCallback, useState } from "react";
import type { xdr } from "@stellar/stellar-sdk";
import { describeError } from "../lib/errors";
import { writeContract, type TxStage } from "../lib/soroban";

export interface TxState {
  stage: TxStage | "idle";
  hash: string | null;
  error: string | null;
  /** Label of the action currently in flight, e.g. "deposit". */
  action: string | null;
}

const IDLE: TxState = { stage: "idle", hash: null, error: null, action: null };

export const STAGE_LABELS: Record<TxStage, string> = {
  simulating: "Simulating transaction…",
  "awaiting-signature": "Waiting for signature in Freighter…",
  submitting: "Submitting to the network…",
  confirming: "Waiting for confirmation…",
  success: "Confirmed",
  error: "Failed",
};

/**
 * Drives one contract write at a time and exposes its stage for the UI.
 * `onSuccess` is where callers refresh on-chain state after confirmation.
 */
export function useTransaction(onSuccess?: () => void | Promise<void>) {
  const [state, setState] = useState<TxState>(IDLE);

  const run = useCallback(
    async (input: {
      action: string;
      contractId: string;
      method: string;
      args?: xdr.ScVal[];
      walletAddress: string;
    }) => {
      setState({ stage: "simulating", hash: null, error: null, action: input.action });
      try {
        const { hash } = await writeContract({
          contractId: input.contractId,
          method: input.method,
          args: input.args,
          walletAddress: input.walletAddress,
          onStage: (stage) =>
            setState((prev) => ({ ...prev, stage, action: input.action })),
        });
        setState({ stage: "success", hash, error: null, action: input.action });
        await onSuccess?.();
        return true;
      } catch (err) {
        setState({
          stage: "error",
          hash: null,
          error: describeError(err),
          action: input.action,
        });
        return false;
      }
    },
    [onSuccess],
  );

  const reset = useCallback(() => setState(IDLE), []);

  const busy =
    state.stage !== "idle" && state.stage !== "success" && state.stage !== "error";

  return { state, run, reset, busy };
}

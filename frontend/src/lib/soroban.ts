import {
  Account,
  Contract,
  Keypair,
  TransactionBuilder,
  scValToNative,
  xdr,
} from "@stellar/stellar-sdk";
import * as rpc from "@stellar/stellar-sdk/rpc";
import { buildUnsignedTransaction, signTransactionWithFreighter } from "@stellaryield/sdk";
import { config } from "../config";

export const server = new rpc.Server(config.rpcUrl, {
  allowHttp: config.rpcUrl.startsWith("http://"),
});

/**
 * Simulation needs a syntactically valid source account but never touches it —
 * the ledger entry does not have to exist. A random keypair keeps read-only
 * calls working before a wallet is connected.
 */
const READ_ONLY_SOURCE = Keypair.random().publicKey();

/**
 * Invoke a contract view function via simulation and return the decoded value.
 * No wallet, no fees, no transaction — this is the read path for the whole app.
 */
export async function readContract<T = unknown>(
  contractId: string,
  method: string,
  args: xdr.ScVal[] = [],
): Promise<T> {
  const account = new Account(READ_ONLY_SOURCE, "0");
  const operation = new Contract(contractId).call(method, ...args);
  const tx = buildUnsignedTransaction({
    account,
    networkPassphrase: config.networkPassphrase,
    operation,
  });

  const sim = await server.simulateTransaction(tx);
  if (rpc.Api.isSimulationError(sim)) {
    throw new Error(sim.error);
  }
  const retval = sim.result?.retval;
  return (retval ? scValToNative(retval) : undefined) as T;
}

/** Progress reported while a write transaction moves through its stages. */
export type TxStage =
  | "simulating"
  | "awaiting-signature"
  | "submitting"
  | "confirming"
  | "success"
  | "error";

export interface WriteResult<T> {
  hash: string;
  returnValue: T;
}

/**
 * Full write path: preflight → wallet signature → submit → confirm.
 *
 * `prepareTransaction` runs the simulation, so an invocation that would panic
 * (KYC, deposit limits, wrong vault state) fails here — before the user is ever
 * asked to sign, and with the contract error code intact.
 */
export async function writeContract<T = unknown>(input: {
  contractId: string;
  method: string;
  args?: xdr.ScVal[];
  walletAddress: string;
  onStage?: (stage: TxStage) => void;
}): Promise<WriteResult<T>> {
  const { contractId, method, args = [], walletAddress, onStage } = input;

  onStage?.("simulating");
  const account = await server.getAccount(walletAddress);
  const operation = new Contract(contractId).call(method, ...args);
  const unsigned = buildUnsignedTransaction({
    account,
    networkPassphrase: config.networkPassphrase,
    operation,
    timeout: 60,
  });
  const prepared = await server.prepareTransaction(unsigned);

  onStage?.("awaiting-signature");
  const { signedTxXdr } = await signTransactionWithFreighter(prepared.toXDR(), {
    networkPassphrase: config.networkPassphrase,
    address: walletAddress,
  });

  onStage?.("submitting");
  const signed = TransactionBuilder.fromXDR(signedTxXdr, config.networkPassphrase);
  const sent = await server.sendTransaction(signed);
  if (sent.status === "ERROR") {
    throw new Error(
      `Submission rejected: ${JSON.stringify(sent.errorResult?.result() ?? sent.status)}`,
    );
  }

  onStage?.("confirming");
  const confirmed = await pollTransaction(sent.hash);
  if (confirmed.status !== rpc.Api.GetTransactionStatus.SUCCESS) {
    throw new Error(
      confirmed.status === rpc.Api.GetTransactionStatus.FAILED
        ? describeFailedTx(confirmed)
        : `Transaction ${sent.hash} did not confirm in time.`,
    );
  }

  onStage?.("success");
  return {
    hash: sent.hash,
    returnValue: (confirmed.returnValue
      ? scValToNative(confirmed.returnValue)
      : undefined) as T,
  };
}

/** Poll until the network reports a terminal status (or we run out of attempts). */
async function pollTransaction(
  hash: string,
  attempts = 30,
  intervalMs = 1_000,
): Promise<rpc.Api.GetTransactionResponse> {
  let response = await server.getTransaction(hash);
  for (let i = 0; i < attempts; i++) {
    if (response.status !== rpc.Api.GetTransactionStatus.NOT_FOUND) return response;
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
    response = await server.getTransaction(hash);
  }
  return response;
}

/**
 * Describe an on-chain failure. Contract panics are normally caught earlier by
 * `prepareTransaction`'s simulation, so failures at this point are usually
 * ledger-level (fees, sequence, expired footprint).
 */
function describeFailedTx(response: rpc.Api.GetFailedTransactionResponse): string {
  try {
    const code = response.resultXdr.result().switch().name;
    return `Transaction failed on-chain (${code}).`;
  } catch {
    return "Transaction failed on-chain.";
  }
}

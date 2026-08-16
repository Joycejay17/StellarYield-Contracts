import { useCallback, useEffect, useState } from "react";
import {
  getAddress,
  isConnected,
  requestAccess,
  setAllowed,
} from "@stellar/freighter-api";
import { describeError } from "../lib/errors";

export interface WalletState {
  address: string | null;
  connecting: boolean;
  error: string | null;
  available: boolean;
  connect: () => Promise<void>;
  disconnect: () => void;
}

/**
 * Freighter connection state. On mount we only check for an *already granted*
 * address so the app never triggers a wallet popup on page load.
 */
export function useWallet(): WalletState {
  const [address, setAddress] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [available, setAvailable] = useState(true);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const connected = await isConnected();
        if (cancelled) return;
        if (connected.error || !connected.isConnected) {
          setAvailable(false);
          return;
        }
        const result = await getAddress();
        if (cancelled) return;
        if (!result.error && result.address) setAddress(result.address);
      } catch {
        if (!cancelled) setAvailable(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const connect = useCallback(async () => {
    setConnecting(true);
    setError(null);
    try {
      await setAllowed();
      const result = await requestAccess();
      if (result.error) throw new Error(String(result.error));
      setAddress(result.address);
    } catch (err) {
      setError(describeError(err));
    } finally {
      setConnecting(false);
    }
  }, []);

  const disconnect = useCallback(() => setAddress(null), []);

  return { address, connecting, error, available, connect, disconnect };
}

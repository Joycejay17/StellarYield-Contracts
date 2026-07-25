-- Add cooperator_address column to vaults so the on-chain cooperator can be
-- persisted instead of read from the RPC on every request.

ALTER TABLE vaults
  ADD COLUMN IF NOT EXISTS cooperator_address TEXT;

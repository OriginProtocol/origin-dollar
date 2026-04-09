import type { Address } from "viem";
import addresses from "../../utils/addresses";

/**
 * Look up a contract address from the contracts/utils/addresses.js registry.
 * Throws if the network or contract name is not found.
 */
export function getAddress(network: string, name: string): Address {
  const networkAddresses = (addresses as Record<string, unknown>)[network];
  if (!networkAddresses || typeof networkAddresses !== "object") {
    throw new Error(`Unknown network "${network}" in address registry`);
  }
  const addr = (networkAddresses as Record<string, string>)[name];
  if (!addr) {
    throw new Error(`Address "${name}" not found on network "${network}"`);
  }
  return addr as Address;
}

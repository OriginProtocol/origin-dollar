import { BigNumber, ethers } from "ethers";
import { hexValue, parseEther } from "ethers/lib/utils";
import type { BatchCall } from "./vaultStrategyMoves";

export const SIMULATE_METHOD = "eth_simulateV1";

const SIMULATED_SAFE_BALANCE = parseEther("10").toHexString();

const ERROR_STRING_SELECTOR = "0x08c379a0";

/** Raw EVM result for one call within an eth_simulateV1 response. */
export interface SimulatedCall {
  /** Hex success status; 0x1 denotes successful execution. */
  status: string;
  returnData: string;
  gasUsed: string;
  error?: { code?: number; message?: string; data?: string };
}

/**
 * Normalizes provider errors and explains unsupported simulation methods.
 * @param error - Provider or transport failure from eth_simulateV1.
 * @param allowExplicitValues - Whether error guidance may mention the proposal action's explicit-value mode.
 * @returns An actionable error; this flag never enables an execution fallback.
 */
function simulationRpcError(error: any, allowExplicitValues: boolean): Error {
  const code = error?.error?.code ?? error?.code;
  const message: string =
    error?.error?.message ?? error?.message ?? String(error);
  if (code === -32601 || /method not (found|supported)/i.test(message)) {
    return new Error(
      `The configured RPC does not support ${SIMULATE_METHOD} (${message}). ` +
        (allowExplicitValues
          ? `Point the network at a provider that implements it, or re-run with --skip-fork plus explicit --expected-profit and --expected-vault-change.`
          : `Point the network at a provider that implements it; unsimulated execution is disabled.`)
    );
  }
  return new Error(`${SIMULATE_METHOD} failed: ${message}`);
}

/**
 * Decodes an Error(string) revert, falling back to the RPC message or raw data.
 * @param call - Failed simulated call and its optional provider error.
 * @returns A readable failure reason, including undecodable payloads when needed.
 */
export function decodeRevert(call: SimulatedCall): string {
  const data = call.error?.data ?? call.returnData;
  if (data && data.startsWith(ERROR_STRING_SELECTOR)) {
    try {
      return ethers.utils.defaultAbiCoder.decode(
        ["string"],
        `0x${data.slice(10)}`
      )[0];
    } catch {
      // Not a well-formed Error(string); fall through to the raw payload.
    }
  }
  return call.error?.message ?? `reverted with ${data || "no return data"}`;
}

/**
 * Rejects the first unsuccessful EVM call with its matching step description.
 * @param simulated - Ordered results returned for the requested calls.
 * @param calls - Corresponding call descriptions used to identify failures.
 * @throws If any call's status is not 0x1.
 */
export function assertCallsSucceeded(
  simulated: SimulatedCall[],
  calls: BatchCall[]
) {
  simulated.forEach((call, index) => {
    if (call.status === "0x1") return;
    throw new Error(
      `Simulation failed at step ${index + 1} of ${simulated.length} (${
        calls[index].description
      }): ${decodeRevert(call)}`
    );
  });
}

/**
 * Executes ordered calls inside one nonpersistent block built on a pinned block tag.
 * @returns One raw result per call; EVM reverts remain results for the caller to inspect.
 * @throws If the RPC fails, simulation is unsupported, or the result count is invalid.
 * @remarks Writes are visible to later calls in this response only. No transaction
 * is broadcast. Signature/transaction validation is disabled so the chosen sender
 * can be simulated, while contract-level authorization still executes. The final
 * repegging-module preflight sets overrideBalance=false to use unmodified state.
 */
export async function simulateCalls({
  provider,
  safeAddress,
  blockTag,
  calls,
  overrideBalance = true,
  allowExplicitValues = true,
}: {
  /** RPC provider implementing eth_simulateV1. */
  provider: ethers.providers.Provider;
  /** Simulated sender: a Safe for derivation or the actual relayer for module preflight. */
  safeAddress: string;
  /** Source block tag, normally a pinned hex block number. */
  blockTag: string;
  /** Ordered calls with raw native-token values and encoded calldata. */
  calls: BatchCall[];
  /** Virtually funds the sender for derivation; false disables all state overrides. */
  overrideBalance?: boolean;
  /** Controls unsupported-RPC guidance only, not validation or execution behavior. */
  allowExplicitValues?: boolean;
}): Promise<SimulatedCall[]> {
  let response: any;
  try {
    response = await (provider as ethers.providers.JsonRpcProvider).send(
      SIMULATE_METHOD,
      [
        {
          blockStateCalls: [
            {
              calls: calls.map((call) => ({
                from: safeAddress,
                to: call.to,
                value: hexValue(BigNumber.from(call.value)),
                data: call.data,
              })),
              ...(overrideBalance
                ? {
                    stateOverrides: {
                      [safeAddress]: { balance: SIMULATED_SAFE_BALANCE },
                    },
                  }
                : {}),
            },
          ],
          validation: false,
          traceTransfers: false,
        },
        blockTag,
      ]
    );
  } catch (error: any) {
    throw simulationRpcError(error, allowExplicitValues);
  }

  const simulated: SimulatedCall[] | undefined = response?.[0]?.calls;
  if (!Array.isArray(simulated) || simulated.length !== calls.length) {
    throw new Error(
      `${SIMULATE_METHOD} returned ${simulated?.length ?? "no"} results for ${
        calls.length
      } calls`
    );
  }
  return simulated;
}

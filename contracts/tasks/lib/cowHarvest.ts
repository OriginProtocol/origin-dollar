import { BigNumber, ethers } from "ethers";
import type { DigestSigner } from "./signer";
import type { Logger } from "./action";
// CJS util.
import addresses from "../../utils/addresses";

/**
 * Off-chain side of the CoW harvesters (`contracts/harvest/HarvestingEIP1271.sol`).
 * Each run sells a harvester's whole balance of every enabled sell token through
 * a CoW order signed for EIP-1271: the signature blob is
 * `abi.encode(Order, r, s, v)`, with (r, s, v) the bot key's signature over
 * `keccak256("\x19COWSWAP order digest:\n32" ‖ hashOrder(order))`.
 *
 * Ported from origin-ops `src/scripts/harvester/cow_harvest.ts` (Railway).
 */

export type HarvesterId = "ousd" | "oeth" | "ogn";

export interface HarvesterConfig {
  /** Descriptor name in deployments/mainnet/. */
  deployment: string;
  receiver: string;
  buyToken: string;
  sellTokens: { address: string; symbol: string }[];
}

const m = addresses.mainnet;

export const HARVESTERS: Record<HarvesterId, HarvesterConfig> = {
  ousd: {
    deployment: "HarvestingEIP1271",
    receiver: m.VaultProxy,
    buyToken: m.USDC,
    sellTokens: [
      { address: m.CRV, symbol: "CRV" },
      { address: m.MorphoToken, symbol: "MORPHO" },
    ],
  },
  oeth: {
    deployment: "harvesting_eip1271_oeth",
    receiver: m.OETHVaultProxy,
    buyToken: m.WETH,
    sellTokens: [
      { address: m.CRV, symbol: "CRV" },
      { address: m.SSV, symbol: "SSV" },
    ],
  },
  ogn: {
    deployment: "harvesting_eip1271_ogn",
    receiver: m.OGNRewardsSource,
    buyToken: m.OGN,
    sellTokens: [
      { address: m.OETHProxy, symbol: "OETH" },
      { address: m.WETH, symbol: "WETH" },
      { address: m.OUSDProxy, symbol: "OUSD" },
      { address: m.USDe, symbol: "USDe" },
    ],
  },
};

export const COW_API_BASE = "https://api.cow.fi/mainnet/api/v1";
export const DEFAULT_APP_DATA = JSON.stringify({ version: "1.3.0" });
export const DEFAULT_SLIPPAGE_BPS = 50;
export const ORDER_VALIDITY_SECONDS = 3600;
export const EIP1271_MAGIC_VALUE = "0x1626ba7e";
export const BOT_SIGN_PREFIX = "\x19COWSWAP order digest:\n32";

const ORDER_TUPLE =
  "tuple(address sellToken, address buyToken, address receiver, " +
  "uint256 sellAmount, uint256 buyAmount, uint32 validTo, bytes32 appData, " +
  "uint256 feeAmount, bytes32 kind, bool partiallyFillable, " +
  "bytes32 sellTokenBalance, bytes32 buyTokenBalance)";

export const HARVESTER_ABI = [
  `function hashOrder(${ORDER_TUPLE} order) view returns (bytes32)`,
  "function isValidSignature(bytes32 hash, bytes signature) view returns (bytes4)",
  "function getMessageSigner(bytes32 orderDigest, bytes32 r, bytes32 s, uint8 v) pure returns (address)",
  "function allowedBuyToken(address) view returns (bool)",
  "function allowedReceiver(address) view returns (bool)",
  "function tokenConfigs(address) view returns (bool enabled, uint256 minSellAmount)",
  "function bot() view returns (address)",
];

export interface Order {
  sellToken: string;
  buyToken: string;
  receiver: string;
  sellAmount: BigNumber;
  buyAmount: BigNumber;
  validTo: number;
  appData: string;
  feeAmount: BigNumber;
  kind: string;
  partiallyFillable: boolean;
  sellTokenBalance: string;
  buyTokenBalance: string;
}

const KIND_SELL = ethers.utils.id("sell");
const BALANCE_ERC20 = ethers.utils.id("erc20");

export function applySlippage(
  buyAmount: BigNumber,
  slippageBps: number
): BigNumber {
  return buyAmount.mul(10_000 - slippageBps).div(10_000);
}

/** A 32-byte hex is used as-is; anything else is the full appData JSON. */
export function appDataHash(appData: string): string {
  return ethers.utils.isHexString(appData, 32)
    ? appData
    : ethers.utils.keccak256(ethers.utils.toUtf8Bytes(appData));
}

export function buildOrder(params: {
  sellToken: string;
  buyToken: string;
  receiver: string;
  sellAmount: BigNumber;
  buyAmount: BigNumber;
  validTo: number;
  appData: string;
}): Order {
  return {
    sellToken: params.sellToken,
    buyToken: params.buyToken,
    receiver: params.receiver,
    sellAmount: params.sellAmount,
    buyAmount: params.buyAmount,
    validTo: params.validTo,
    appData: appDataHash(params.appData),
    // The harvester rejects any order with a non-zero fee.
    feeAmount: BigNumber.from(0),
    kind: KIND_SELL,
    partiallyFillable: false,
    sellTokenBalance: BALANCE_ERC20,
    buyTokenBalance: BALANCE_ERC20,
  };
}

/** The hash the bot key signs, mirroring `getMessageSigner`. */
export function botSignHash(orderDigest: string): string {
  return ethers.utils.keccak256(
    ethers.utils.concat([
      ethers.utils.toUtf8Bytes(BOT_SIGN_PREFIX),
      orderDigest,
    ])
  );
}

export function encodeEip1271Signature(
  order: Order,
  sig: ethers.Signature
): string {
  return ethers.utils.defaultAbiCoder.encode(
    [ORDER_TUPLE, "bytes32", "bytes32", "uint8"],
    [order, sig.r, sig.s, sig.v]
  );
}

type FetchFn = typeof fetch;

export async function fetchQuote(
  fetchImpl: FetchFn,
  apiBase: string,
  params: {
    sellToken: string;
    buyToken: string;
    receiver: string;
    from: string;
    sellAmount: BigNumber;
    appData: string;
  }
): Promise<BigNumber> {
  const res = await fetchImpl(`${apiBase}/quote`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      sellToken: params.sellToken,
      buyToken: params.buyToken,
      receiver: params.receiver,
      appData: params.appData,
      sellTokenBalance: "erc20",
      buyTokenBalance: "erc20",
      from: params.from,
      priceQuality: "verified",
      signingScheme: "eip712",
      onchainOrder: false,
      kind: "sell",
      sellAmountBeforeFee: params.sellAmount.toString(),
    }),
  });
  if (!res.ok) {
    throw new Error(`CoW quote failed (${res.status}): ${await res.text()}`);
  }
  const body = (await res.json()) as { quote?: { buyAmount?: string } };
  if (!body.quote?.buyAmount) {
    throw new Error(`CoW quote has no buyAmount: ${JSON.stringify(body)}`);
  }
  return BigNumber.from(body.quote.buyAmount);
}

export async function postOrder(
  fetchImpl: FetchFn,
  apiBase: string,
  order: Order,
  appData: string,
  from: string,
  signature: string
): Promise<string> {
  const res = await fetchImpl(`${apiBase}/orders`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      sellToken: order.sellToken,
      buyToken: order.buyToken,
      receiver: order.receiver,
      sellAmount: order.sellAmount.toString(),
      buyAmount: order.buyAmount.toString(),
      validTo: order.validTo,
      appData,
      feeAmount: order.feeAmount.toString(),
      kind: "sell",
      partiallyFillable: order.partiallyFillable,
      sellTokenBalance: "erc20",
      buyTokenBalance: "erc20",
      signingScheme: "eip1271",
      signature,
      from,
    }),
  });
  const text = await res.text();
  if (!res.ok) {
    // The API reports the hash it computed; a mismatch with ours points at an
    // encoding difference rather than a bad key.
    const apiHash = text.match(/computed order hash (0x[0-9a-fA-F]{64})/)?.[1];
    throw new Error(
      `CoW order rejected (${res.status}): ${text}` +
        (apiHash ? ` [api order hash ${apiHash}]` : "")
    );
  }
  return text.replace(/"/g, "");
}

export interface HarvestContext {
  harvester: ethers.Contract;
  balanceOf(token: string): Promise<BigNumber>;
  signer: DigestSigner;
  fetchImpl: FetchFn;
  apiBase: string;
  appData: string;
  slippageBps: number;
  validTo: number;
  receiver: string;
  buyToken: string;
  dryrun: boolean;
  log: Logger;
}

export type TokenResult =
  | { status: "skipped"; reason: string }
  | { status: "posted"; uid: string }
  | { status: "dryrun" };

export async function harvestToken(
  ctx: HarvestContext,
  token: { address: string; symbol: string }
): Promise<TokenResult> {
  const { harvester, log } = ctx;
  const tag = `[${token.symbol}]`;

  const [enabled, minSellAmount] = await harvester.tokenConfigs(token.address);
  if (!enabled) return { status: "skipped", reason: "token disabled" };

  const sellAmount = await ctx.balanceOf(token.address);
  if (sellAmount.isZero()) return { status: "skipped", reason: "no balance" };
  if (sellAmount.lt(minSellAmount)) {
    return {
      status: "skipped",
      reason: `balance ${sellAmount} below minSellAmount ${minSellAmount}`,
    };
  }

  const quotedBuy = await fetchQuote(ctx.fetchImpl, ctx.apiBase, {
    sellToken: token.address,
    buyToken: ctx.buyToken,
    receiver: ctx.receiver,
    from: harvester.address,
    sellAmount,
    appData: ctx.appData,
  });
  const buyAmount = applySlippage(quotedBuy, ctx.slippageBps);
  log.info(
    `${tag} sell ${sellAmount} for >= ${buyAmount} (quote ${quotedBuy}, ` +
      `${ctx.slippageBps} bps slippage)`
  );

  const order = buildOrder({
    sellToken: token.address,
    buyToken: ctx.buyToken,
    receiver: ctx.receiver,
    sellAmount,
    buyAmount,
    validTo: ctx.validTo,
    appData: ctx.appData,
  });
  const digest: string = await harvester.hashOrder(order);
  const sig = await ctx.signer.signDigest(botSignHash(digest));
  const signature = encodeEip1271Signature(order, sig);

  const recovered: string = await harvester.getMessageSigner(
    digest,
    sig.r,
    sig.s,
    sig.v
  );
  const magic: string = await harvester.isValidSignature(digest, signature);
  log.info(
    `${tag} digest ${digest}, recovered signer ${recovered}, ` +
      `isValidSignature ${magic}`
  );

  if (ctx.dryrun) {
    if (recovered.toLowerCase() !== ctx.signer.address.toLowerCase()) {
      throw new Error(
        `${tag} recovered ${recovered}, expected ${ctx.signer.address}`
      );
    }
    log.info(`${tag} dry run, not posting`);
    return { status: "dryrun" };
  }

  if (magic.toLowerCase() !== EIP1271_MAGIC_VALUE) {
    throw new Error(
      `${tag} harvester rejects the signature (isValidSignature ${magic}); ` +
        `not posting`
    );
  }

  const uid = await postOrder(
    ctx.fetchImpl,
    ctx.apiBase,
    order,
    ctx.appData,
    harvester.address,
    signature
  );
  log.info(`${tag} posted https://explorer.cow.fi/orders/${uid}`);
  return { status: "posted", uid };
}

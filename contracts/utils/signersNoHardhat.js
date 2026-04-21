const ethers = require("ethers");
const { Defender } = require("@openzeppelin/defender-sdk");
const { resolveEthersV5Signer } = require("@automaton/client");
const log = require("./logger")("utils:signers");

// origin-relayer-production-evm
const DEFAULT_KMS_RELAYER_ID = "mrk-248128595151466bb7f7b9a56501a98f";

// Task-specific relayer overrides. Picked up by resolveKmsRelayerId and
// forwarded to @automaton/client via the { keyId } option.
const TASK_KMS_RELAYER_ID_OVERRIDES = {};

let signerContext = {
  relayerId: undefined,
  taskName: undefined,
};

const hasAwsKmsCredentials = () => {
  return !!process.env.AWS_ACCESS_KEY_ID && !!process.env.AWS_SECRET_ACCESS_KEY;
};

const resolveKmsRelayerId = (context = signerContext) => {
  if (context.relayerId) {
    return context.relayerId;
  }
  if (
    context.taskName &&
    TASK_KMS_RELAYER_ID_OVERRIDES[context.taskName] !== undefined
  ) {
    return TASK_KMS_RELAYER_ID_OVERRIDES[context.taskName];
  }
  return DEFAULT_KMS_RELAYER_ID;
};

const withTaskSignerContext = async (context, fn) => {
  const previousContext = signerContext;
  signerContext = {
    ...previousContext,
    ...context,
  };
  try {
    return await fn();
  } finally {
    signerContext = previousContext;
  }
};

/**
 * KMS-backed ethers v5 Signer. Delegates to @automaton/client's
 * resolveEthersV5Signer, which wraps the library's AWS KMS SignerCore
 * (DER → (r,s) → EIP-2 low-s → parity search) in an ethers v5 adapter.
 * The contextual relayerId (from withTaskSignerContext / --relayerId) is
 * passed through as the explicit `keyId` option.
 */
const getKmsSigner = async (hre) => {
  const keyId = resolveKmsRelayerId();
  return await resolveEthersV5Signer(hre.ethers.provider, { keyId });
};

/**
 * Resolve the Ethereum address for a KMS key.
 * If relayerId is not provided, task context / defaults are used.
 * @param {object} params
 * @param {string} params.relayerId optional explicit relayer id / kms key id
 * @param {string} params.taskName optional task name for task-map resolution
 * @param {object} params.provider optional ethers provider for signer construction
 * @returns {Promise<string>} ethereum address
 */
const getKmsAddress = async ({ relayerId, taskName, provider } = {}) => {
  const keyId = resolveKmsRelayerId({
    ...signerContext,
    relayerId,
    taskName,
  });
  const signer = await resolveEthersV5Signer(
    provider || ethers.getDefaultProvider(),
    { keyId }
  );
  const address = await signer.getAddress();
  log(`Resolved KMS Ethereum address ${address} from relayer-id "${keyId}"`);
  return address;
};

const getDefenderSigner = async () => {
  const speed = process.env.SPEED || "fastest";
  if (!["safeLow", "average", "fast", "fastest"].includes(speed)) {
    console.error(
      `Defender Relay Speed param must be either 'safeLow', 'average', 'fast' or 'fastest'. Not "${speed}"`
    );
    process.exit(2);
  }

  const { chainId } = await ethers.getDefaultProvider().getNetwork();

  const isMainnet = chainId === 1;

  const relayerApiKey = isMainnet
    ? process.env.DEFENDER_API_KEY
    : process.env.HOLESKY_DEFENDER_API_KEY || process.env.DEFENDER_API_KEY;
  const relayerApiSecret = isMainnet
    ? process.env.DEFENDER_API_SECRET
    : process.env.HOLESKY_DEFENDER_API_SECRET ||
      process.env.DEFENDER_API_SECRET;

  const credentials = {
    relayerApiKey,
    relayerApiSecret,
  };

  const client = new Defender(credentials);
  const provider = client.relaySigner.getProvider({ ethersVersion: "v5" });

  const signer = await client.relaySigner.getSigner(provider, {
    speed,
    ethersVersion: "v5",
  });
  log(
    `Using Defender Relayer account ${await signer.getAddress()} with speed "${speed}" from env vars DEFENDER_API_KEY and DEFENDER_API_SECRET`
  );

  return signer;
};

module.exports = {
  getDefenderSigner,
  getKmsSigner,
  getKmsAddress,
  hasAwsKmsCredentials,
  withTaskSignerContext,
  DEFAULT_KMS_RELAYER_ID,
};

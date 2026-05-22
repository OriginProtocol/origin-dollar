const ethers = require("ethers");
const { DirectKmsTransactionSigner } = require("@lastdotnet/purrikey");
const { Defender } = require("@openzeppelin/defender-sdk");
const log = require("./logger")("utils:signers");

// origin-relayer-production-evm
const DEFAULT_KMS_RELAYER_ID = "mrk-248128595151466bb7f7b9a56501a98f";
const AWS_KMS_REGION = "us-east-1";

// Task specific relayer overrides.
const TASK_KMS_RELAYER_ID_OVERRIDES = {};

let signerContext = {
  relayerId: undefined,
  taskName: undefined,
};

const hasAwsKmsCredentials = () => {
  // Static IAM user creds (legacy / local dev).
  if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
    return true;
  }
  // ECS task role: the SDK fetches temporary creds from the task metadata
  // endpoint at this URL. Set automatically by Fargate when a task role
  // is attached, so its presence is a reliable "KMS is reachable from
  // this process" signal — we don't need to inject static keys.
  if (
    process.env.AWS_CONTAINER_CREDENTIALS_RELATIVE_URI ||
    process.env.AWS_CONTAINER_CREDENTIALS_FULL_URI
  ) {
    return true;
  }
  return false;
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
  // Transition shim: prefer the env-injected key id. The hardcoded default
  // is the old-org key, kept only until the new-org cutover completes
  // (see talos Claude.Cleanup.md).
  return process.env.KMS_RELAYER_ID || DEFAULT_KMS_RELAYER_ID;
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

const getKmsSigner = async (hre) => {
  const relayerId = resolveKmsRelayerId();
  return new DirectKmsTransactionSigner(
    relayerId,
    hre.ethers.provider,
    AWS_KMS_REGION
  );
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
  const signer = new DirectKmsTransactionSigner(
    keyId,
    provider || ethers.getDefaultProvider(),
    AWS_KMS_REGION
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

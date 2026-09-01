const ethers = require("ethers");
const { DirectKmsTransactionSigner } = require("@lastdotnet/purrikey");
const log = require("./logger")("utils:signers");

// New-org production EVM signing key (account 114563866192,
// alias talos-prod-evm-signer). Overridden by KMS_RELAYER_ID in prod.
const DEFAULT_KMS_RELAYER_ID = "f153abb3-12be-4fa4-be0d-bceeb796ff3e";
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
  // Prefer the env-injected key id; the default is the new-org production key.
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

module.exports = {
  getKmsSigner,
  getKmsAddress,
  hasAwsKmsCredentials,
  withTaskSignerContext,
  resolveKmsRelayerId,
  DEFAULT_KMS_RELAYER_ID,
  AWS_KMS_REGION,
};

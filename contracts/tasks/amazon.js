require("dotenv").config();
const { Buffer } = require("node:buffer");
const {
  KMSClient,
  EncryptCommand,
  DecryptCommand,
} = require("@aws-sdk/client-kms"); // CommonJS import
const { p2pApiEncodedKey } = require("../utils/constants");
/*
 * keyId created in AWS KMS. That private key never leaves Amazon KMS. That Amazon key
 * is used to decode the private key that is encoded with it in 'hexEncodedMasterPrivateKey'
 * variable.
 *
 * In order to have permission for key decoding one needs
 * AWS_ACCESS_KEY_ID & AWS_SECRET_ACCESS_KEY of the "validator_key_manager" AWS IAM account
 * which only has access to said private key in the KMS.
 *
 * Be careful since different AWS_ACCESS_KEY_ID & AWS_SECRET_ACCESS_KEY are used for storing / fetching
 * files from S3 buckets.
 */
const amazonKMSKeyId = "2db3f148-ffda-43d3-8099-7a9f5bab09cc";
//const hexPublicKey = "BExtrXKUJRoST70MPo5IEn0nMBdAjU+BP5FVomlclimQxBMf/Xlc7B7GkADZpQTFmS5cVgF0Gc+gv1wHLZjc3D0=";
const region = "us-east-1";

const encryptMasterPrivateKey = async ({ privateKey }) => {
  if (!privateKey) {
    throw new Error("Please provide a private key");
  }
  const client = new KMSClient({
    region,
  });
  const input = {
    KeyId: amazonKMSKeyId,
    Plaintext: Buffer.from(privateKey),
    EncryptionAlgorithm: "RSAES_OAEP_SHA_1",
    DryRun: false,
  };

  const response = await client.send(new EncryptCommand(input));
  const hexEncodedPrivateKey = Buffer.from(response.CiphertextBlob).toString(
    "hex"
  );
  console.log("Hex encoded private key: ", hexEncodedPrivateKey);
};

const decryptMasterPrivateKey = async () => {
  const hexEncodedMasterPrivateKey =
    process.env.VALIDATOR_MASTER_ENCRYPTED_PRIVATE_KEY;
  if (!hexEncodedMasterPrivateKey) {
    throw new Error(
      "Please set VALIDATOR_MASTER_ENCRYPTED_PRIVATE_KEY environment variable"
    );
  }

  const client = new KMSClient({
    region,
  });
  const uintArrayHex = Uint8Array.from(
    Buffer.from(hexEncodedMasterPrivateKey, "hex")
  );
  const input = {
    // DecryptRequest
    CiphertextBlob: uintArrayHex,
    KeyId: amazonKMSKeyId,
    EncryptionAlgorithm: "RSAES_OAEP_SHA_1",
    DryRun: false,
  };
  const response = await client.send(new DecryptCommand(input));

  const decoder = new TextDecoder("utf8");
  return decoder.decode(response.Plaintext);
};

module.exports = {
  encryptMasterPrivateKey,
  decryptMasterPrivateKey,
  p2pApiEncodedKey,
};

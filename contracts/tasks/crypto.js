const bls = require("@rigidity/bls-signatures");
const {
  subtle,
  createCipheriv,
  createECDH,
  createHash,
  createHmac,
} = require("node:crypto");

const { decryptMasterPrivateKey } = require("./amazon");
const { getPrivateKeyFromS3 } = require("../utils/amazon");
const ecdhCurveName = "prime256v1";

const genECDHKey = async ({ privateKey, displayPk }) => {
  const ecdh = createECDH(ecdhCurveName);

  if (privateKey) {
    ecdh.setPrivateKey(Buffer.from(privateKey, "hex"));
  } else {
    ecdh.generateKeys();
    console.log(
      "Generated private key (hex format):",
      ecdh.getPrivateKey("hex")
    );
  }

  const publicKeyBase64 = ecdh.getPublicKey("base64");

  if (displayPk) {
    console.log(`Private key: ${ecdh.getPrivateKey("hex")}`);
  }
  console.log(`Public  key: ${publicKeyBase64}`);

  const subtleKey = await subtle.importKey(
    "raw",
    ecdh.getPublicKey(),
    { name: "ECDH", namedCurve: "P-256" },
    true,
    []
  );
  const fmtKey = await subtle.exportKey("spki", subtleKey);
  const publicKeyPEM = `-----BEGIN PUBLIC KEY-----\n${Buffer.from(fmtKey)
    .toString("base64")
    .replace(/.{64}/g, "$&\n")
    .replace(/\n$/g, "")}\n-----END PUBLIC KEY-----\n`;
  console.log(`Public key in PEM format:\n${publicKeyPEM.toString()}`);

  // base64 encode the PEM format again to get P2P format
  const p2pPublicKey = Buffer.from(publicKeyPEM).toString("base64");
  console.log(`Encoded public key for P2P API:\n${p2pPublicKey}`);
};

const decryptValidatorKey = async ({
  privateKey,
  encryptedKey,
  pubkey,
  displayPk,
}) => {
  if (pubkey) {
    const json = JSON.parse(
      await getPrivateKeyFromS3({
        pubkey,
        awsS3AccessKeyId: process.env.AWS_ACCESS_S3_KEY_ID,
        awsS3SexcretAccessKeyId: process.env.AWS_SECRET_S3_ACCESS_KEY,
        s3BucketName: process.env.VALIDATOR_KEYS_S3_BUCKET_NAME,
      })
    );
    encryptedKey = json.encryptedPrivateKey;
    if (!encryptedKey) {
      throw new Error("No encrypted key found in S3.");
    }
  } else if (!encryptedKey) {
    throw new Error(
      "encryptedKey option must be used if no pubkey is provided."
    );
  }

  const ecdh = createECDH(ecdhCurveName);

  if (!privateKey) {
    privateKey = await decryptMasterPrivateKey();
  }
  ecdh.setPrivateKey(privateKey, "hex");

  const validatorPrivateKey = decrypt(
    ecdh,
    Buffer.from(encryptedKey, "base64")
  );
  if (displayPk) {
    console.log(
      `Validator private key: ${validatorPrivateKey.toString("hex")}`
    );
  }

  const vsk = bls.PrivateKey.fromBytes(validatorPrivateKey);
  console.log(`Validator public key: ${vsk.getG1().toHex()}`);
  return validatorPrivateKey.toString("hex");
};

const decryptValidatorKeyWithMasterKey = async ({ message }) => {
  const privateKey = await decryptMasterPrivateKey();
  return decryptValidatorKey({ privateKey, message });
};

const decryptValidatorKeyFromStorage = async ({
  privatekey,
  pubkey,
  displaypk,
}) => {
  const json = JSON.parse(
    await getPrivateKeyFromS3({
      pubkey,
      awsS3AccessKeyId: process.env.AWS_ACCESS_S3_KEY_ID,
      awsS3SexcretAccessKeyId: process.env.AWS_SECRET_S3_ACCESS_KEY,
      s3BucketName: process.env.VALIDATOR_KEYS_S3_BUCKET_NAME,
    })
  );
  const encryptedKey = json.encryptedPrivateKey;

  if (!privatekey) {
    privatekey = await decryptMasterPrivateKey();
  }

  const privateValidatorKey = await decryptValidatorKey({
    privateKey: privatekey,
    message: encryptedKey,
  });

  if (displaypk) {
    console.log("Private validator key: ", privateValidatorKey);
  }
};

const decrypt = (ecdh, msg) => {
  const epk = msg.slice(0, 65);
  const message = msg.slice(65, msg.length - 32);
  const sharedSecret = ecdh.computeSecret(epk);
  const { encKey, macKey } = deriveKeys(sharedSecret, Buffer.alloc(0), 16);
  const tag = messageTag(macKey, message, Buffer.alloc(0));
  if (tag.toString("hex") !== msg.slice(msg.length - 32).toString("hex")) {
    throw new Error("tag mismatch");
  }
  return symDecrypt(encKey, message);
};

const deriveKeys = (secret, s1, keyLen) => {
  const keys = concatKDF(secret, s1, keyLen * 2);
  const encKey = keys.slice(0, keyLen);
  const macKey = createHash("sha256")
    .update(keys.slice(keyLen, keyLen * 2))
    .digest();
  return { encKey, macKey };
};

const messageTag = (macKey, message, s2) => {
  return createHmac("sha256", macKey).update(message).update(s2).digest();
};

const symDecrypt = (key, ct) => {
  const c = createCipheriv("aes-128-ctr", key, ct.slice(0, 16));
  const m = Buffer.alloc(ct.length - 16);
  c.update(ct.slice(16)).copy(m);
  return m;
};

const concatKDF = (secret, s1, keyLen) => {
  let hashSum = Buffer.from("");
  for (let ctr = 1; hashSum.length < keyLen; ctr++) {
    const ctrs = Buffer.from([ctr >> 24, ctr >> 16, ctr >> 8, ctr]); // Buffer.from([ctr >> 24, ctr >> 16, ctr >> 8, ctr])
    const tmp = [
      hashSum,
      createHash("sha256")
        .update(Buffer.concat([ctrs, secret, s1]))
        .digest(),
    ];
    hashSum = Buffer.concat(tmp);
  }
  return hashSum.slice(0, keyLen);
};

const signMessage = async ({ signer, message }) => {
  console.log(`Message: ${message}`);
  console.log(`Signer: ${await signer.getAddress()}`);

  const hash = await signer.signMessage(message);
  console.log(`Hash: ${hash}`);
};

module.exports = {
  genECDHKey,
  decryptValidatorKey,
  decryptValidatorKeyWithMasterKey,
  decryptValidatorKeyFromStorage,
  signMessage,
};

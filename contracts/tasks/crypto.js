const {
  createCipheriv,
  createECDH,
  createDecipheriv,
  randomBytes,
} = require("node:crypto");

const ecdhCurveName = "prime256v1";
const encryptionAlgorithm = "aes-256-cbc";

const genECDHKey = async ({ privateKey }) => {
  const ecdh = createECDH(ecdhCurveName);

  if (privateKey) {
    ecdh.setPrivateKey(Buffer.from(privateKey, "base64"));
  } else {
    ecdh.generateKeys();
  }

  const privateKeyBase64 = ecdh.getPrivateKey("base64");
  const publicKeyBase64 = ecdh.getPublicKey("base64");

  console.log(`Private key: ${privateKeyBase64}`);
  console.log(`Public  key: ${publicKeyBase64}`);

  // convert the public key to PEM format
  const publicKeyPEM = `-----BEGIN PUBLIC KEY-----\n${publicKeyBase64
    .replace(/.{64}/g, "$&\n")
    .replace(/\n$/g, "")}\n-----END PUBLIC KEY-----\n`;
  console.log(`Public key in PEM format:\n${publicKeyPEM.toString()}`);

  // base64 encode the PEM format again to get P2P format
  const p2pPublicKey = Buffer.from(publicKeyPEM).toString("base64");
  console.log(`Encoded public key for P2P API:\n${p2pPublicKey}`);
};

const encrypt = async ({ privateKey, publicKey, text }) => {
  const ecdh = createECDH(ecdhCurveName);
  ecdh.setPrivateKey(Buffer.from(privateKey, "base64"));

  console.log(`My private key ${ecdh.getPrivateKey("base64")}`);
  console.log(`My public key ${ecdh.getPublicKey("base64", "spki")}`);

  const otherPublicKey = Buffer.from(publicKey, "base64");

  const secretKey = ecdh.computeSecret(otherPublicKey, "base64", "base64");
  console.log("secretKey:", secretKey.toString("base64"));

  const initializationVector = randomBytes(16);
  console.log(
    "initialization vector:",
    initializationVector.toString("base64")
  );

  const cipher = createCipheriv(
    encryptionAlgorithm,
    secretKey,
    initializationVector
  );

  const encrypted = Buffer.concat([cipher.update(text), cipher.final()]);

  console.log("encrypted content:", encrypted.toString("base64"));
};

const decrypt = async ({ privateKey, publicKey, text, iv }) => {
  const ecdh = createECDH(ecdhCurveName);
  ecdh.setPrivateKey(Buffer.from(privateKey, "base64"));

  console.log(`My private key ${ecdh.getPrivateKey("base64")}`);
  console.log(`My public key ${ecdh.getPublicKey("base64", "spki")}`);

  const otherPublicKey = Buffer.from(publicKey, "base64");
  const secretKey = ecdh.computeSecret(otherPublicKey, "base64", "base64");
  console.log("Secret:", secretKey);

  const decipher = createDecipheriv(
    encryptionAlgorithm,
    secretKey,
    Buffer.from(iv, "base64")
  );

  const decryptedContent = Buffer.concat([
    decipher.update(Buffer.from(text, "base64")),
    decipher.final(),
  ]);
  console.log(`Decrypted content: ${decryptedContent.toString()}`);
};

module.exports = {
  genECDHKey,
  encrypt,
  decrypt,
};

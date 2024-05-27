const { createECDH, createCipheriv } = require("node:crypto");

const ecdhCurveName = "prime256v1";

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

const decryptValidatorKey = async ({ privateKey, encryptedMessage }) => {
  const client = createECDH("prime256v1");
  client.setPrivateKey(privateKey, "hex");

  const decryptedMessage = decrypt(
    client.getPrivateKey(),
    Buffer.from(encryptedMessage, "base64")
  );

  console.log(decryptedMessage.toString("utf8"));
};

const decrypt = (privateKey, msg) => {
  const ecdh = createECDH("prime256v1");
  ecdh.setPrivateKey(privateKey);
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
  const macKey = crypto
    .createHash("sha256")
    .update(keys.slice(keyLen, keyLen * 2))
    .digest();
  return { encKey, macKey };
};

const messageTag = (macKey, message, s2) => {
  return crypto
    .createHmac("sha256", macKey)
    .update(message)
    .update(s2)
    .digest();
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
      crypto
        .createHash("sha256")
        .update(Buffer.concat([ctrs, secret, s1]))
        .digest(),
    ];
    console.log(tmp);
    hashSum = Buffer.concat(tmp);
  }
  return hashSum.slice(0, keyLen);
};

module.exports = {
  genECDHKey,
  decryptValidatorKey,
};

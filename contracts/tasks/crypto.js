const bls = require("@rigidity/bls-signatures");
const {
  subtle,
  createCipheriv,
  createECDH,
  createHash,
  createHmac,
} = require("node:crypto");

const ecdhCurveName = "prime256v1";

const genECDHKey = async ({ privateKey }) => {
  const ecdh = createECDH(ecdhCurveName);

  if (privateKey) {
    ecdh.setPrivateKey(Buffer.from(privateKey, "hex"));
  } else {
    ecdh.generateKeys();
  }

  const publicKeyBase64 = ecdh.getPublicKey("base64");

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

const decryptValidatorKey = async ({ privateKey, message }) => {
  const ecdh = createECDH(ecdhCurveName);
  ecdh.setPrivateKey(privateKey, "hex");

  const validatorPrivateKey = decrypt(ecdh, Buffer.from(message, "base64"));

  const vsk = bls.PrivateKey.fromBytes(validatorPrivateKey);
  console.log(`Validator public key: ${vsk.getG1().toHex()}`);
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

module.exports = {
  genECDHKey,
  decryptValidatorKey,
};
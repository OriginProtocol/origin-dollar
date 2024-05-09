const {
  createPrivateKey,
  createPublicKey,
  generateKeyPair,
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
    console.log(`Private key ${privateKey}`);
    const pair = ecdh.setPrivateKey(Buffer.from(privateKey, "base64"));
    const publicKeyPem = ecdh.getPublicKey("pem", "spki");

    // console.log(`Public key:\n${ecdh.getPublicKey("base64")}`);
    // console.log(
    //   `Encoded public key for P2P API:\n${ecdh
    //     .getPublicKey("base64")
    //     .toString("base64")}`
    // );
    return;
  }

  ecdh.generateKeys();
  const privateKeyBase64 = ecdh.getPrivateKey("base64");
  const publicKeyBase64 = ecdh.getPublicKey("base64");

  console.log(`Private key ${privateKeyBase64}`);
  console.log(`Public key:\n${publicKeyBase64}`);

  // Create a PublicKey object from the ECDH instance
  const publicKeyObj = createPublicKey({
    key: ecdh.getPublicKey(),
    format: "der",
    type: "spki",
  });

  // Export the public key in PEM format
  const publicKeyPem = publicKeyObj.export({ type: "spki", format: "pem" });
  console.log(`Public key in PEM format ${publicKeyPem.toString("base64")}`);

  //   const publicKey = createPublicKey(privateKeyBase64);
  //   console.log(`Public key in PEM format ${ecdh.getPublicKey("pem", "spki")}`);
  //   console.log(
  //     `Encoded public key for P2P API:\n${publicKeyPem.toString("base64")}`
  //   );
};

const genECDHKey2 = async ({ privateKey }) => {
  if (privateKey) {
    console.log(`Private key ${privateKey}`);
    const ecdh = createECDH(ecdhCurveName);
    // const pk = createPrivateKey({
    //   key: Buffer.from(privateKey, "base64"),
    //   format: "der",
    //   type: "pkcs8",
    // });

    const pk = createPrivateKey({
      key: Buffer.from(privateKey, "base64"),
      type: "pkcs8", // 'sec1' or 'pkcs8', depending on the format
      format: "der",
    });

    const pair = ecdh.setPrivateKey(Buffer.from(privateKey, "base64"));
    // const pair = ecdh.setPrivateKey(
    //   pk.export({ type: "pkcs8", format: "der" }).toString("base64")
    // );
    console.log(`Public key:\n${pair.publicKey.toString("base64")}`);
    console.log(
      `Encoded public key for P2P API:\n${Buffer.from(pair.publicKey).toString(
        "base64"
      )}`
    );
    return;
  }

  return new Promise((resolve, reject) => {
    // Generate an elliptic curve key pair using the secp256r1 curve
    generateKeyPair(
      "ec",
      {
        namedCurve: ecdhCurveName, // is the same as secp256r1
        publicKeyEncoding: {
          type: "spki", // Use Subject Public Key Info format
          format: "pem", // Encoding format
        },
        privateKeyEncoding: {
          type: "pkcs8", // Use Public-Key Cryptography Standards 8 format
          format: "der", // Encoding format
        },
      },
      (err, publicKey, pk) => {
        if (err) return reject(err);

        console.log(`Private key ${pk.toString("base64")}`);
        console.log(`Public key:\n${publicKey.toString("base64")}`);
        console.log(
          `Encoded public key for P2P API:\n${Buffer.from(publicKey).toString(
            "base64"
          )}`
        );

        const pk2 = createPrivateKey({
          key: Buffer.from(pk.toString("base64"), "base64"),
          type: "pkcs8", // 'sec1' or 'pkcs8', depending on the format
          format: "der",
        });
        console.log(
          `Private key 2 ${pk2
            .export({ type: "pkcs8", format: "der" })
            .toString("base64")}`
        );
        const ecdh = createECDH(ecdhCurveName);
        const base64PrivateKey =
          "MHcCAQEEIG6AQo/0h2C4sK1cIlTVTFLEmTSzCk++c5jeUG+KjCp6oAoGCCqGSM49AwEHoUQDQgAEZtnrHukMrlO+2rONXOHfncFtgsZ+lqnr5Y0l6XBbeyEOv7iz6SyeUMWtUlWGsWE9sbzMFs7owEhrcz0sxf58eA==";

        const pair = ecdh.setPrivateKey(
          Buffer.from(base64PrivateKey, "base64")
        );
        console.log(`Private key 3 ${pair.toString("base64")}`);

        resolve();
      }
    );
  });
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

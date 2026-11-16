#!/usr/bin/env node
const { execFileSync } = require("node:child_process");
const { createPublicKey } = require("node:crypto");
const { ethers } = require("ethers");

const keyId =
  process.env.HOODI_KMS_RELAYER_ID || "alias/talos-prod-hoodi-evm-signer";
const result = JSON.parse(
  execFileSync(
    "aws",
    [
      "kms",
      "get-public-key",
      "--key-id",
      keyId,
      "--region",
      "us-east-1",
      "--output",
      "json",
    ],
    { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }
  )
);
if (result.KeySpec !== "ECC_SECG_P256K1" || result.KeyUsage !== "SIGN_VERIFY") {
  throw new Error("Hoodi relayer must be an ECC_SECG_P256K1 signing key");
}
const jwk = createPublicKey({
  key: Buffer.from(result.PublicKey, "base64"),
  format: "der",
  type: "spki",
}).export({ format: "jwk" });
const uncompressed = Buffer.concat([
  Buffer.from([4]),
  Buffer.from(jwk.x, "base64url"),
  Buffer.from(jwk.y, "base64url"),
]);
console.log(ethers.utils.computeAddress(uncompressed));

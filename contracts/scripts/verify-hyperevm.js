const fs = require("fs");
const path = require("path");

const API_URL = "https://api.etherscan.io/v2/api?chainId=999";
const CONTRACT_ADDRESS = "0x5F4e7e9d3259dfA181cF7ed5611FDcB13d47F233";
const COMPILER_VERSION = "v0.8.28+commit.7893614a";
const CONTRACT_NAME =
  "contracts/strategies/crosschain/CrossChainRemoteStrategy.sol:CrossChainRemoteStrategy";

// ABI-encoded constructor args (from creation tx)
const CONSTRUCTOR_ARGS =
  "000000000000000000000000e90959cbe7e56b5ebff9ad12de611a4976f2d2b1" +
  "0000000000000000000000000000000000000000000000000000000000000000" +
  "00000000000000000000000028b5a0e9c621a5badaa536219b3a228c8168cf5d" +
  "00000000000000000000000081d40f21f12a8f0e3252bccb954d722d4c464b64" +
  "0000000000000000000000000000000000000000000000000000000000000000" +
  "000000000000000000000000e0228db13f8c4eb00fd1e08e076b09ef5cd0ea1e" +
  "000000000000000000000000b88339cb7199b77e23db6e890353e22632ba630f" +
  "000000000000000000000000a0b86991c6218b36c1d19d4a2e9eb0ce3606eb48";

async function main() {
  // Load .env if dotenv available, otherwise rely on env var
  try {
    require("dotenv").config();
  } catch (e) {
    // dotenv not available, use env vars directly
  }
  const apiKey = process.env.ETHERSCAN_API_KEY;
  if (!apiKey) {
    console.error("Set ETHERSCAN_API_KEY env var");
    process.exit(1);
  }

  // Load solcInput
  const solcInputPath = path.join(
    __dirname,
    "../deployments/hyperevm/solcInputs/602ca2e0e707756bb450999668dc9420.json"
  );
  const sourceCode = fs.readFileSync(solcInputPath, "utf8");

  console.log("Submitting verification request...");

  // Submit verification
  const params = new URLSearchParams({
    apikey: apiKey,
    module: "contract",
    action: "verifysourcecode",
    contractaddress: CONTRACT_ADDRESS,
    sourceCode: sourceCode,
    codeformat: "solidity-standard-json-input",
    contractname: CONTRACT_NAME,
    compilerversion: COMPILER_VERSION,
    constructorArguements: CONSTRUCTOR_ARGS,
  });

  const submitRes = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });

  const rawText = await submitRes.text();
  console.log("Status:", submitRes.status);
  console.log("Content-Type:", submitRes.headers.get("content-type"));
  if (!rawText.startsWith("{")) {
    console.log("Raw response (first 500 chars):", rawText.slice(0, 500));
    process.exit(1);
  }
  const submitData = JSON.parse(rawText);
  console.log("Submit response:", JSON.stringify(submitData, null, 2));

  if (submitData.status !== "1") {
    console.error("Submission failed:", submitData.result);
    process.exit(1);
  }

  const guid = submitData.result;
  console.log(`GUID: ${guid}`);
  console.log("Polling for verification status...");

  // Poll for result
  for (let i = 0; i < 20; i++) {
    await new Promise((r) => setTimeout(r, 5000));

    const checkParams = new URLSearchParams({
      apikey: apiKey,
      module: "contract",
      action: "checkverifystatus",
      guid: guid,
    });

    const checkRes = await fetch(`${API_URL}&${checkParams.toString()}`);
    const checkData = await checkRes.json();
    console.log(`Attempt ${i + 1}:`, JSON.stringify(checkData, null, 2));

    if (checkData.result !== "Pending in queue") {
      if (checkData.status === "1") {
        console.log("Verification successful!");
      } else {
        console.error("Verification failed:", checkData.result);
      }
      return;
    }
  }
  console.log(
    "Timed out waiting for verification. Check manually with GUID:",
    guid
  );
}

main().catch(console.error);

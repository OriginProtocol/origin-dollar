const { ethers } = require("ethers");

const {
  DefenderRelaySigner,
  DefenderRelayProvider,
} = require("@openzeppelin/defender-relay-client/lib/ethers");

// const addresses = require("../../utils/addresses");
const { logTxDetails } = require("../../utils/txLogger");
const log = require("../../utils/logger")("action:claimBribes");

// Claim Bribes module for Coinbase AERO Locker Safe
const COINBASE_AERO_LOCKER_MODULE =
  "0x60D3D6eC213d84DEa193dbd79673340061178893";

const MODULE_ABI = [
  "function getNFTIdsLength() external view returns (uint256)",
  "function fetchNFTIds() external",
  "function removeAllNFTIds() external",
  "function claimBribes(uint256 nftIndexStart, uint256 nftIndexEnd, bool silent) external",
];

const handler = async (event) => {
  const provider = new DefenderRelayProvider(event);
  const signer = new DefenderRelaySigner(event, provider, { speed: "fastest" });

  const network = await provider.getNetwork();
  if (network.chainId != 8453) {
    throw new Error("Only supported on Base");
  }

  const aeroLockerModule = new ethers.Contract(
    COINBASE_AERO_LOCKER_MODULE,
    MODULE_ABI,
    signer
  );

  log(`Claiming bribes from Coinbase AERO Locker Safe`);
  await manageNFTsOnModule(aeroLockerModule, signer);
  await claimBribesFromModule(aeroLockerModule, signer);
};

async function manageNFTsOnModule(module, signer) {
  // Remove all NFTs from the module
  let tx = await module.connect(signer).removeAllNFTIds({
    gasLimit: 8000000,
  });
  logTxDetails(tx, `removeAllNFTIds`);

  // Fetch all NFTs from the veNFT contract
  tx = await module.connect(signer).fetchNFTIds({
    gasLimit: 16000000,
  });
  logTxDetails(tx, `fetchNFTIds`);
}

async function claimBribesFromModule(module, signer) {
  const nftIdsLength = (
    await module.connect(signer).getNFTIdsLength()
  ).toNumber();
  const batchSize = 100;
  const batchCount = Math.ceil(nftIdsLength / batchSize);

  log(`Found ${nftIdsLength} NFTs on the module`);
  log(`Claiming bribes in ${batchCount} batches of ${batchSize}`);

  for (let i = 0; i < batchCount; i++) {
    const start = i * batchSize;
    const end = Math.min(start + batchSize, nftIdsLength);

    const tx = await module.connect(signer).claimBribes(start, end, true);
    await logTxDetails(
      tx,
      `claimBribes (batch ${i + 1} of ${batchCount})`
    );
  }
}

module.exports = { handler };

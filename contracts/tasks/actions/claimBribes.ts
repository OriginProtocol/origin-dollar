import { ethers } from "ethers";
import type { Logger } from "../lib/action";
import { logTxDetails } from "../../utils/txLogger";
import { action } from "../lib/action";

const COINBASE_AERO_LOCKER_MODULE =
  "0x60d3d6ec213d84dea193dbd79673340061178893";
const OLD_GUARDIAN_MODULE = "0x26179ada0f7cb714c11a8190e1f517988c28e759";

const moduleLabels: Record<string, string> = {
  [COINBASE_AERO_LOCKER_MODULE]: "Coinbase AERO Locker Safe",
  [OLD_GUARDIAN_MODULE]: "Old Guardian Safe",
};

const batchSizes: Record<string, number> = {
  [COINBASE_AERO_LOCKER_MODULE]: 50,
  [OLD_GUARDIAN_MODULE]: 50,
};

const MODULE_ABI = [
  "function getNFTIdsLength() external view returns (uint256)",
  "function fetchNFTIds() external",
  "function removeAllNFTIds() external",
  "function claimBribes(uint256 nftIndexStart, uint256 nftIndexEnd, bool silent) external",
];

async function manageNFTsOnModule(
  module: ethers.Contract,
  signer: ethers.Signer,
  log: Logger
) {
  const label = moduleLabels[module.address.toLowerCase()];

  log.info(`Running removeAllNFTIds on module ${label}`);
  let tx = await module.connect(signer).removeAllNFTIds();
  logTxDetails(tx, "removeAllNFTIds");
  await tx.wait();

  log.info(`Running fetchNFTIds on module ${label}`);
  tx = await module.connect(signer).fetchNFTIds();
  logTxDetails(tx, "fetchNFTIds");
  await tx.wait();
}

async function claimBribesFromModule(
  module: ethers.Contract,
  signer: ethers.Signer,
  log: Logger
) {
  const nftIdsLength = (
    await module.connect(signer).getNFTIdsLength()
  ).toNumber();
  const batchSize = batchSizes[module.address.toLowerCase()] || 50;
  const batchCount = Math.ceil(nftIdsLength / batchSize);

  log.info(`Found ${nftIdsLength} NFTs on the module`);
  log.info(`Claiming bribes in ${batchCount} batches of ${batchSize}`);

  for (let i = 0; i < batchCount; i++) {
    const start = i * batchSize;
    const end = Math.min(start + batchSize, nftIdsLength);

    const tx = await module.connect(signer).claimBribes(start, end, true);
    await logTxDetails(tx, `claimBribes (batch ${i + 1} of ${batchCount})`);
  }
}

action({
  name: "claimBribes",
  description: "Claim bribes from Aerodrome veNFT lockers on Base",
  chains: [8453],
  run: async ({ signer, log }) => {
    const modules = [COINBASE_AERO_LOCKER_MODULE, OLD_GUARDIAN_MODULE];

    for (const moduleAddr of modules) {
      const module = new ethers.Contract(moduleAddr, MODULE_ABI, signer);
      log.info(
        `Claiming bribes from ${moduleLabels[moduleAddr.toLowerCase()]}`
      );
      await manageNFTsOnModule(module, signer, log);
      await claimBribesFromModule(module, signer, log);
    }
  },
});

// imports
const { sendProposal } = require("./utils/deploy");
const { proposeArgs } = require("./utils/governor");
const addresses = require("./utils/addresses");
const { BigNumber } = ethers;
const { compensationSync } = require("./scripts/compensation/compensationSync");
const reimbursementsLocation = "./scripts/staking/reimbursements.csv";
const signers = await hre.ethers.getSigners();

// Setup impersonation signers
const compensationClaims = await ethers.getContractAt("CompensationClaims", addresses.mainnet.CompensationClaims);
const ousd = await ethers.getContractAt("OUSD", addresses.mainnet.OUSDProxy);
await hre.network.provider.request({method: "hardhat_impersonateAccount",params: [addresses.mainnet.Binance]});
const governorAddress = "0x8e7bdfecd1164c46ad51b58e49a611f954d23377";
await hre.network.provider.request({method: "hardhat_impersonateAccount",params: [governorAddress]});
const adjusterAddress = "0x71f78361537a6f7b6818e7a760c8bc0146d93f50";
await hre.network.provider.request({method: "hardhat_impersonateAccount",params: [adjusterAddress]});

const binanceSigner = await hre.ethers.provider.getSigner(addresses.mainnet.Binance);
const governorSigner = await hre.ethers.provider.getSigner(governorAddress);
const adjusterSigner = await hre.ethers.provider.getSigner(adjusterAddress);

// UPLOADING CLAIMS DATA
//check if adjuster locked
await compensationClaims.isAdjusterLocked();

// unlocks the adjuster
const propResetArgs = await proposeArgs([
  { contract: compensationClaims, signature: "unlockAdjuster()" },
]);
await sendProposal(propResetArgs, "Unlock the adjuster");

// Upload compensation data
await compensationSync(compensationClaims, reimbursementsLocation, true, adjusterSigner);

// Locks adjuster
const propResetArgsLock = await proposeArgs([{ contract: compensationClaims, signature: "lockAdjuster()" }]);
await sendProposal(propResetArgsLock, "Lock the adjuster");

//verify compensation data
await compensationSync(compensationClaims, reimbursementsLocation);
// END UPLOADING CLAIMS DATA

//// TRANSFER OUSD
/* To fund the below account with 2m OUSD run the following tasks:
 * - FORK=true npx hardhat fund --num 1 --amount 2010000 --network localhost
 * - FORK=true npx hardhat mint --num 1 --amount 2000000 --network localhost
 */
const signerWithOUSD = signers[4]
(await ousd.balanceOf(signerWithOUSD.address)).toString();
// transfer OUSD to vault
await ousd.connect(signerWithOUSD).transfer(compensationClaims.address, ethers.utils.parseUnits("1696590", 18));
//// END TRANSFER OUSD

// start compensation period
const startArgs = await proposeArgs([{ contract: compensationClaims, signature: "start(uint256)", args: [60 * 60 * 24 * 90]}]);
await sendProposal(startArgs, "Start OUSD claiming period");

// OGN compensation
const { parseCsv } = require("./utils/fileSystem");
const { compensationData } = require("./scripts/staking/constants");
const { extractOGNAmount, computeRootHash } = require("./utils/stake");

const cOGNStakingProxy = await ethers.getContract("OGNStakingProxy");
// Initialize the SingleAssetStaking contract.
const cOGNStaking = await ethers.getContractAt("SingleAssetStaking", cOGNStakingProxy.address);
// Ran agains mainnet fork using command `compute-merkle-proofs-local` and saved in top comment: contracts/tasks/compensation.js
const root = { hash: "0x304013b1a650e205f3210663cdea44d1af2785d275268276a299c663ee2e4615", depth: 10 }

const propArgsSetRoot = await proposeArgs([{ contract: cOGNStaking, signature: "setAirDropRoot(uint8,bytes32,uint256)", args: [1, root.hash, root.depth]}]);
await sendProposal(propArgsSetRoot, "Set airdrop root hash");
// End OF OGN compensation

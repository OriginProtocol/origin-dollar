const ethers = require("ethers");
const { formatUnits, parseEther } = require("ethers/lib/utils");

const addresses = require("../utils/addresses");
const { logTxDetails } = require("../utils/txLogger");
const cumulativeMerkleDropAbi = require("../abi/cumulative_merkle_drop.json");
const erc20Abi = require("../abi/erc20.json");

const log = require("../utils/logger")("task:ssvRewards");

const SSV_REWARDS_API = "https://www.ssvrewards.com";
const MIN_CLAIM_AMOUNT = parseEther("1");

const getLatestMerkleProofFile = async () => {
  const url = `${SSV_REWARDS_API}/api/list-files/?directory=mainnetIncentives`;
  log(`Listing available Merkle proof files from ${url}`);

  const response = await fetch(url);
  if (!response.ok) {
    throw Error(
      `Failed to list Merkle proof files: ${response.status} ${response.statusText}`
    );
  }
  const files = await response.json();

  if (!files || files.length === 0) {
    throw Error("No Merkle proof files available");
  }

  const latest = files[files.length - 1];
  log(`Latest Merkle proof file: ${latest}`);
  return latest;
};

const getSSVRewardsEntry = async (account) => {
  const filename = await getLatestMerkleProofFile();
  const url = `${SSV_REWARDS_API}/data/mainnetIncentives/${filename}`;
  log(`Fetching Merkle proof data from ${url}`);

  const response = await fetch(url);
  if (!response.ok) {
    throw Error(
      `Failed to fetch Merkle proof data: ${response.status} ${response.statusText}`
    );
  }
  const { root, data } = await response.json();

  const entry = data.find(
    (e) => e.address.toLowerCase() === account.toLowerCase()
  );

  if (!entry) {
    log(`No entry found for ${account}`);
    return null;
  }

  log(
    `Found entry: ${formatUnits(entry.amount, 18)} SSV cumulative entitlement`
  );
  return { root, ...entry };
};

async function getSSVRewardsStatus(provider) {
  const account = addresses.mainnet.validatorRegistrator;
  const entry = await getSSVRewardsEntry(account);

  if (!entry) {
    return {
      account,
      cumulativeEntitlement: ethers.BigNumber.from(0),
      cumulativeClaimed: ethers.BigNumber.from(0),
      unclaimed: ethers.BigNumber.from(0),
      claimable: false,
    };
  }

  const distributor = new ethers.Contract(
    addresses.mainnet.SSVRewardsDistributor,
    cumulativeMerkleDropAbi,
    provider
  );

  const onChainRoot = await distributor.merkleRoot();
  const cumulativeClaimed = await distributor.cumulativeClaimed(account);
  const cumulativeEntitlement = ethers.BigNumber.from(entry.amount);
  const unclaimed = cumulativeEntitlement.sub(cumulativeClaimed);
  const rootMatches = onChainRoot === entry.root;

  return {
    account,
    cumulativeEntitlement,
    cumulativeClaimed,
    unclaimed,
    onChainRoot,
    proofRoot: entry.root,
    rootMatches,
    claimable: rootMatches && unclaimed.gte(MIN_CLAIM_AMOUNT),
    entry,
  };
}

async function claimSSVRewards(signer) {
  const account = addresses.mainnet.validatorRegistrator;
  const entry = await getSSVRewardsEntry(account);

  if (!entry) {
    log(`No SSV rewards entry found for ${account}. Skipping.`);
    return;
  }

  const distributor = new ethers.Contract(
    addresses.mainnet.SSVRewardsDistributor,
    cumulativeMerkleDropAbi,
    signer
  );

  const onChainRoot = await distributor.merkleRoot();
  if (onChainRoot !== entry.root) {
    log(
      `On-chain Merkle root ${onChainRoot} does not match proof root ${entry.root}. Skipping.`
    );
    return;
  }

  const cumulativeClaimed = await distributor.cumulativeClaimed(account);
  const cumulativeEntitlement = ethers.BigNumber.from(entry.amount);
  const unclaimed = cumulativeEntitlement.sub(cumulativeClaimed);

  log(`Cumulative entitlement: ${formatUnits(cumulativeEntitlement, 18)} SSV`);
  log(`Already claimed:        ${formatUnits(cumulativeClaimed, 18)} SSV`);
  log(`Unclaimed:              ${formatUnits(unclaimed, 18)} SSV`);

  if (unclaimed.lt(MIN_CLAIM_AMOUNT)) {
    log(
      `Unclaimed amount ${formatUnits(
        unclaimed,
        18
      )} SSV is below minimum ${formatUnits(
        MIN_CLAIM_AMOUNT,
        18
      )} SSV. Skipping.`
    );
    return;
  }

  const claimTx = await distributor.claim(
    account,
    entry.amount,
    entry.root,
    entry.proof
  );
  await logTxDetails(claimTx, "claimSSVRewards");

  const ssvToken = new ethers.Contract(addresses.mainnet.SSV, erc20Abi, signer);

  const forwardTo = addresses.multichainStrategist;
  const balance = await ssvToken.balanceOf(await signer.getAddress());
  log(
    `Forwarding ${formatUnits(
      balance,
      18
    )} SSV to multichainStrategist ${forwardTo}`
  );

  const transferTx = await ssvToken.transfer(forwardTo, balance);
  await logTxDetails(transferTx, "transferSSV");
}

module.exports = { claimSSVRewards, getSSVRewardsEntry, getSSVRewardsStatus };

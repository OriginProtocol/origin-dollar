const { utils, BigNumber } = require("ethers");

const extractOGNAmount = (payoutList) => {
  return {
    ...payoutList,
    payouts: payoutList.payouts.map((each) => [
      each.address,
      each.ogn_compensation,
    ]),
  };
};

const getTotals = (payoutList) => {
  const { rate, payouts } = payoutList;
  let total = BigNumber.from(0);
  let reward = BigNumber.from(0);

  for (const payout of payouts) {
    total = total.add(payout[1]);
    const calReward = BigNumber.from(payout[1])
      .mul(rate)
      .div(BigNumber.from("1000000000000000000"));
    reward = reward.add(calReward);
  }
  return { total, reward };
};

const hash = (index, type, contract, address, duration, rate, amount) => {
  return utils.solidityKeccak256(
    ["uint", "uint8", "address", "address", "uint", "uint", "uint"],
    [index, type, contract, address, duration, rate, amount]
  );
};

const getLeaves = (contractAddress, payoutList) => {
  const { type, duration, rate, payouts } = payoutList;

  return payouts.map(function (payout, i) {
    return hash(i, type, contractAddress, payout[0], duration, rate, payout[1]);
  });
};

const reduceMerkleBranches = (leaves) => {
  var output = [];

  while (leaves.length) {
    var left = leaves.shift();
    var right = leaves.length === 0 ? left : leaves.shift();
    output.push(utils.keccak256(utils.concat([left, right])));
  }

  output.forEach(function (leaf) {
    leaves.push(leaf);
  });
};

const computeRootHash = (contractAddress, payoutList) => {
  var leaves = getLeaves(contractAddress, payoutList);
  let depth = 0;
  while (leaves.length > 1) {
    reduceMerkleBranches(leaves);
    depth++;
  }

  return { hash: leaves[0], depth };
};

const verifyMerkleSignature = (
  merkleRootNodeHash,
  merkleTreeDepth,
  contractAddress,
  accountAddress,
  index,
  stakeType,
  duration,
  rate,
  amount,
  merkleProof
) => {
  if (stakeType === 0) {
    throw new Error("Can not be user stake type");
  }
  if (index >= 2 ** merkleProof.length) {
    throw new Error("Invalid index");
  }
  if (merkleProof.length !== merkleTreeDepth) {
    throw new Error("Proof length is not the same as merkle tree depth");
  }

  const nodeHash = (node1, node2) => {
    return utils.solidityKeccak256(["bytes", "bytes"], [node1, node2]);
  };

  let node = hash(
    index,
    stakeType,
    contractAddress,
    accountAddress,
    duration,
    rate,
    amount
  );

  let path = index;
  for (let i = 0; i < merkleProof.length; i++) {
    if ((path & 0x01) == 1) {
      node = utils.keccak256(utils.concat([merkleProof[i], node]));
    } else {
      node = utils.keccak256(utils.concat([node, merkleProof[i]]));
    }
    path /= 2;
  }

  // Check the merkle proof
  return node == merkleRootNodeHash;
};
const computeMerkleProof = (contractAddress, payoutList, index) => {
  const leaves = getLeaves(contractAddress, payoutList);

  if (index == null) {
    throw new Error("address not found");
  }

  var path = index;

  var proof = [];
  while (leaves.length > 1) {
    if (path % 2 == 1) {
      proof.push(leaves[path - 1]);
    } else {
      proof.push(leaves[path + 1 < leaves.length ? path + 1 : path]);
    }

    // Reduce the merkle tree one level
    reduceMerkleBranches(leaves);

    // Move up
    path = parseInt(path / 2);
  }

  return proof;
};

module.exports = {
  extractOGNAmount,
  getTotals,
  hash,
  getLeaves,
  reduceMerkleBranches,
  computeRootHash,
  computeMerkleProof,
  verifyMerkleSignature,
};

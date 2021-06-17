const ognAbi = require("../test/abi/ogn.json");
const addresses = require("../utils/addresses");
const { utils } = require("ethers");

const { proposeArgs } = require("../utils/governor");

/*
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
*/

async function ognOwnership(taskArguments) {
  const oldMultisigAddress = '0xe011fA2a6Df98c69383457d87a056Ed0103aA352'
  const newMultisigAddress = '0xbe2AB3d3d8F6a32b96414ebbd865dBD276d3d899'

  const ogn = await ethers.getContractAt(ognAbi, addresses.mainnet.OGN);

  const oldOwner = await ogn.owner()
  console.log('Old OGN owner:', oldOwner)

  // Impersonate the old multi-sig and fund it with ETH.
  await hre.network.provider.request({
    method: "hardhat_impersonateAccount",
    params: [addresses.mainnet.Binance],
  });
  await hre.network.provider.request({
    method: "hardhat_impersonateAccount",
    params: [oldMultisigAddress],
  });
  const binanceSigner = await ethers.provider.getSigner(
    addresses.mainnet.Binance
  );
  const oldMultisigSigner = await ethers.provider.getSigner(oldMultisigAddress)

  await binanceSigner.sendTransaction({
    to: oldMultisigAddress,
    value: utils.parseEther('10'),
  });

  // Transfer ownership
  await ogn.connect(oldMultisigSigner).transferOwnership(newMultisigAddress)

  // Check owner was updated.
  const newOwner = await ogn.owner()
  console.log('New OGN owner:', newOwner)
}

/*
async function ousdOwnership(taskArguments) {
  const oldMultisigAddress = '0xe011fA2a6Df98c69383457d87a056Ed0103aA352'
  const newMultisigAddress = '0xbe2AB3d3d8F6a32b96414ebbd865dBD276d3d899'

  const governor = await ethers.getContract("Governor");
  console.log('Governor address:', governor.address)

  const oldAdmin = await governor.admin()
  console.log('Old Governor admin:', oldAdmin)

  // Impersonate the old and new multi-sig and fund them with ETH.
  await hre.network.provider.request({
    method: "hardhat_impersonateAccount",
    params: [addresses.mainnet.Binance],
  });
  await hre.network.provider.request({
    method: "hardhat_impersonateAccount",
    params: [oldMultisigAddress],
  });
  await hre.network.provider.request({
    method: "hardhat_impersonateAccount",
    params: [newMultisigAddress],
  });

  const binanceSigner = await ethers.provider.getSigner(
    addresses.mainnet.Binance
  );
  const oldMultisigSigner = await ethers.provider.getSigner(oldMultisigAddress)
  const newMultisigSigner = await ethers.provider.getSigner(newMultisigAddress)

  await binanceSigner.sendTransaction({
    to: oldMultisigAddress,
    value: utils.parseEther('10'),
  });
  await binanceSigner.sendTransaction({
    to: newMultisigAddress,
    value: utils.parseEther('10'),
  });

  // Transfer ownership to the new admin by creating a proposal and executing it.
  //await governor.connect(oldMultisigSigner).setPendingAdmin(newMultisigAddress)
  console.log("Sending proposal...")
  const propDescription = "Update governor admin";
  const propArgs = await proposeArgs([
    {
      contract: governor,
      signature: "setPendingAdmin(address)",
      args: [newMultisigAddress],
    },
  ])
  const proposalId = await governor.propose(...propArgs, propDescription)
  console.log("New proposal created:", proposalId)
  await governor.connect(oldMultisigSigner).queue(proposalId)
  // Wait for the timelock before executing.
  console.log("Waiting for timelock...")
  await sleep(61000)
  await governor.connect(oldMultisigSigner).execute(proposalId)

  // Accept ownership.
  console.log("Accepting ownership")
  await governor.connect(newMultisigSigner).acceptAdmin()

  // Check admin was updated.
  const newAdmin = await governor.admin()
  console.log('New Governor admin:', newAdmin)
}
 */

module.exports = {
  ognOwnership,
  ousdOwnership
};
const ognAbi = require("../test/abi/ogn.json");
const addresses = require("../utils/addresses");
const { utils } = require("ethers");

const { proposeArgs } = require("../utils/governor");

/*
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
*/

async function marketplaceOwnership(taskArguments) {
  const oldMultisigAddress = "0x8A1A4f77F9F0eb35FB9930696038Be6220986C1b";
  const newMultisigAddress = "0x73150A2C2B5855550598Bb076BaF2d2aa8255733";

  const MarketplaceV0Addr = "0x819bb9964b6ebf52361f1ae42cf4831b921510f9";
  const MarketplaceV1Addr = "0x698ff47b84837d3971118a369c570172ee7e54c2";

  const marketplaceAbi = [
    "function transferOwnership(address)",
    "function owner() view returns (address)",
  ];
  const marketplace0 = new ethers.Contract(
    MarketplaceV0Addr,
    marketplaceAbi,
    hre.ethers.provider
  );
  const marketplace1 = new ethers.Contract(
    MarketplaceV1Addr,
    marketplaceAbi,
    hre.ethers.provider
  );

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
  const oldMultisigSigner = await ethers.provider.getSigner(oldMultisigAddress);

  await binanceSigner.sendTransaction({
    to: oldMultisigAddress,
    value: utils.parseEther("10"),
  });

  // Transfer ownership
  console.log(
    `Transferring ownership of ${marketplace1.address} from ${oldMultisigSigner.address} to ${newMultisigAddress}`
  );
  await marketplace0
    .connect(oldMultisigSigner)
    .transferOwnership(newMultisigAddress);
  console.log(
    `Transferring ownership of ${marketplace1.address} from ${oldMultisigSigner.address} to ${newMultisigAddress}`
  );
  await marketplace1
    .connect(oldMultisigSigner)
    .transferOwnership(newMultisigAddress);

  // Check owner was updated.
  let newOwner = await marketplace0.owner();
  console.log("New owner for v0 marketplace:", newOwner);
  newOwner = await marketplace1.owner();
  console.log("New owner for v1 marketplace:", newOwner);
}

async function ognOwnership(taskArguments) {
  const oldMultisigAddress = "0xe011fA2a6Df98c69383457d87a056Ed0103aA352";
  const newMultisigAddress = "0xbe2AB3d3d8F6a32b96414ebbd865dBD276d3d899";

  const ogn = await ethers.getContractAt(ognAbi, addresses.mainnet.OGN);

  const oldOwner = await ogn.owner();
  console.log("Old OGN owner:", oldOwner);

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
  const oldMultisigSigner = await ethers.provider.getSigner(oldMultisigAddress);

  await binanceSigner.sendTransaction({
    to: oldMultisigAddress,
    value: utils.parseEther("10"),
  });

  // Transfer ownership
  await ogn.connect(oldMultisigSigner).transferOwnership(newMultisigAddress);

  // Check owner was updated.
  const newOwner = await ogn.owner();
  console.log("New OGN owner:", newOwner);
}

module.exports = {
  marketplaceOwnership,
  ognOwnership,
};

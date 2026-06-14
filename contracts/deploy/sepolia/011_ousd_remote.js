/**
 * Sepolia testnet (Remote side) — OUSD Remote strategy (proxy + impl).
 *
 * Mirrors 003_remote_strategy.js but for the parallel OUSD V3 stack. Uses
 * the OUSD strategy CREATE3 salt so the proxy lands at the SAME address as
 * the OUSD Master proxy on Base Sepolia (peer parity invariant).
 *
 * Artifacts registered:
 *   - OUSDRemoteStrategyProxy   (CrossChainStrategyProxy at deterministic addr)
 *   - OUSDRemoteStrategy        (RemoteWOTokenStrategy impl — chain-specific addr)
 */
const addresses = require("../../utils/addresses");
const { encodeSaltForCreateX } = require("../../utils/deploy");
const createxAbi = require("../../abi/createx.json");

const SALT = "OUSD V3 Testnet wOUSD Strategy 1";
const ADDR_FOR_SALT = "0x0000000000006f726967696e70726f746f636f6c";
const CONTRACT_CREATION_TOPIC =
  "0xb8fda7e00c6b06a2b54e58521bc5894fee35f1090e5a3bb6390bfe2b98b497f7";

module.exports = async (hre) => {
  const { ethers, deployments } = hre;
  const { deploy } = deployments;
  const { deployerAddr } = await hre.getNamedAccounts();
  const sDeployer = await ethers.provider.getSigner(deployerAddr);

  console.log(`[sepolia] 011_ousd_remote — deployer=${deployerAddr}`);

  // --- 1. Deploy proxy via CreateX ---
  const cCreateX = await ethers.getContractAt(createxAbi, addresses.createX);
  const encodedSalt = encodeSaltForCreateX(ADDR_FOR_SALT, false, SALT);

  const ProxyFactory = await ethers.getContractFactory(
    "CrossChainStrategyProxy"
  );
  const proxyInitCode = ethers.utils.hexConcat([
    ProxyFactory.bytecode,
    ProxyFactory.interface.encodeDeploy([deployerAddr]),
  ]);
  const guardedSalt = ethers.utils.keccak256(encodedSalt);
  const predictedProxyAddr = await cCreateX[
    "computeCreate2Address(bytes32,bytes32)"
  ](guardedSalt, ethers.utils.keccak256(proxyInitCode));
  console.log(`Predicted OUSD Remote proxy address: ${predictedProxyAddr}`);

  const proxyCode = await ethers.provider.getCode(predictedProxyAddr);
  let proxyAddress = predictedProxyAddr;
  if (proxyCode === "0x") {
    const tx = await cCreateX
      .connect(sDeployer)
      .deployCreate2(encodedSalt, proxyInitCode);
    const receipt = await tx.wait();
    proxyAddress = ethers.utils.getAddress(
      `0x${receipt.events
        .find((e) => e.topics[0] === CONTRACT_CREATION_TOPIC)
        .topics[1].slice(26)}`
    );
    console.log(`Deployed OUSDRemoteStrategyProxy at ${proxyAddress}`);
  } else {
    console.log(`Proxy already deployed at ${proxyAddress}`);
  }

  await deployments.save("OUSDRemoteStrategyProxy", {
    address: proxyAddress,
    abi: ProxyFactory.interface.format("json"),
  });

  // --- 2. Deploy Remote impl with USDC + OUSD mocks ---
  const dOTokenVault = await deployments.get("MockOUSDVault");
  const dOToken = await deployments.get("MockOUSD");
  const dWOToken = await deployments.get("MockWOUSD");

  const dRemoteImpl = await deploy("OUSDRemoteStrategy", {
    from: deployerAddr,
    contract: "RemoteWOTokenStrategy",
    args: [
      {
        platformAddress: dWOToken.address, // = woToken per Remote constructor
        vaultAddress: ethers.constants.AddressZero, // Remote not registered with any vault
      },
      addresses.sepolia.USDC, // bridgeAsset
      dOToken.address, // oToken
      dWOToken.address, // woToken
      dOTokenVault.address, // oTokenVault
    ],
    log: true,
  });
  console.log(`OUSDRemoteStrategy impl: ${dRemoteImpl.address}`);

  // --- 3. Initialise the proxy ---
  const cProxy = await ethers.getContractAt(
    "InitializeGovernedUpgradeabilityProxy",
    proxyAddress,
    sDeployer
  );
  const implOnProxy = await cProxy.implementation();
  if (implOnProxy === ethers.constants.AddressZero) {
    const cRemoteImpl = await ethers.getContractAt(
      "RemoteWOTokenStrategy",
      dRemoteImpl.address
    );
    const initData = cRemoteImpl.interface.encodeFunctionData(
      "initialize(address)",
      [deployerAddr]
    );
    const tx = await cProxy["initialize(address,address,bytes)"](
      dRemoteImpl.address,
      deployerAddr,
      initData
    );
    await tx.wait();
    console.log(`Initialised proxy → impl + governor + operator = deployer`);
  } else {
    console.log(`Proxy already initialised (impl=${implOnProxy})`);
  }

  return true;
};

module.exports.id = "sepolia_011_ousd_remote";
module.exports.tags = ["sepolia"];
module.exports.dependencies = ["sepolia_010_mock_ousd"];
module.exports.skip = async () => {
  const hre = require("hardhat");
  return hre.network.name !== "sepolia";
};

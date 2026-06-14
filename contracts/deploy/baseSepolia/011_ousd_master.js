/**
 * Base Sepolia testnet — OUSD Master strategy (proxy + impl).
 *
 * Mirrors 002_master_strategy.js but for the parallel OUSD V3 stack:
 *   - Different CREATE3 salt (so OUSD lands at a different peer-parity
 *     address pair than OETHb V3).
 *   - Constructor uses USDC as bridgeAsset and MockOUSDb as oToken.
 *
 * Artifacts registered:
 *   - OUSDMasterStrategyProxy   (CrossChainStrategyProxy at deterministic addr)
 *   - OUSDMasterStrategy        (MasterWOTokenStrategy impl — chain-specific addr)
 */
const addresses = require("../../utils/addresses");
const { encodeSaltForCreateX } = require("../../utils/deploy");
const createxAbi = require("../../abi/createx.json");

const SALT = "OUSD V3 Testnet wOUSD Strategy 1";

module.exports = async (hre) => {
  const { ethers, deployments, getNamedAccounts } = hre;
  const { deploy } = deployments;
  const { deployerAddr } = await getNamedAccounts();
  const sDeployer = await ethers.provider.getSigner(deployerAddr);

  console.log(`[baseSepolia] 011_ousd_master — deployer=${deployerAddr}`);

  // --- 1. Deploy proxy via CreateX (deterministic, matches Sepolia) ---
  const cCreateX = await ethers.getContractAt(createxAbi, addresses.createX);
  const addrForSalt = "0x0000000000006f726967696e70726f746f636f6c"; // "originprotocol"
  const encodedSalt = encodeSaltForCreateX(addrForSalt, false, SALT);

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
  console.log(`Predicted OUSD Master proxy address: ${predictedProxyAddr}`);

  const proxyCode = await ethers.provider.getCode(predictedProxyAddr);
  let proxyAddress = predictedProxyAddr;
  if (proxyCode === "0x") {
    const tx = await cCreateX
      .connect(sDeployer)
      .deployCreate2(encodedSalt, proxyInitCode);
    const receipt = await tx.wait();
    const ContractCreationTopic =
      "0xb8fda7e00c6b06a2b54e58521bc5894fee35f1090e5a3bb6390bfe2b98b497f7";
    proxyAddress = ethers.utils.getAddress(
      `0x${receipt.events
        .find((e) => e.topics[0] === ContractCreationTopic)
        .topics[1].slice(26)}`
    );
    console.log(`Deployed OUSDMasterStrategyProxy at ${proxyAddress}`);
  } else {
    console.log(`Proxy already deployed at ${proxyAddress}`);
  }

  await deployments.save("OUSDMasterStrategyProxy", {
    address: proxyAddress,
    abi: ProxyFactory.interface.format("json"),
  });

  // --- 2. Deploy Master impl with USDC + MockOUSDb constructor args ---
  const dVault = await deployments.get("MockOUSDbVault");
  const dOToken = await deployments.get("MockOUSDb");

  const dMasterImpl = await deploy("OUSDMasterStrategy", {
    from: deployerAddr,
    contract: "MasterWOTokenStrategy",
    args: [
      {
        platformAddress: ethers.constants.AddressZero,
        vaultAddress: dVault.address,
      },
      addresses.baseSepolia.USDC,
      dOToken.address,
    ],
    log: true,
  });
  console.log(`OUSDMasterStrategy impl: ${dMasterImpl.address}`);

  // --- 3. Initialise the proxy (idempotent) ---
  const cProxy = await ethers.getContractAt(
    "InitializeGovernedUpgradeabilityProxy",
    proxyAddress,
    sDeployer
  );
  const implOnProxy = await cProxy.implementation();
  if (implOnProxy === ethers.constants.AddressZero) {
    const cMasterImpl = await ethers.getContractAt(
      "MasterWOTokenStrategy",
      dMasterImpl.address
    );
    const initData = cMasterImpl.interface.encodeFunctionData(
      "initialize(address)",
      [deployerAddr] // operator = deployer on testnet
    );
    const tx = await cProxy["initialize(address,address,bytes)"](
      dMasterImpl.address,
      deployerAddr, // governor = deployer on testnet
      initData
    );
    await tx.wait();
    console.log(`Initialised proxy → impl + governor + operator = deployer`);
  } else {
    console.log(`Proxy already initialised (impl=${implOnProxy})`);
  }

  return true;
};

module.exports.id = "baseSepolia_011_ousd_master";
module.exports.tags = ["baseSepolia"];
module.exports.dependencies = ["baseSepolia_010_mock_ousdb"];
module.exports.skip = async () => {
  const hre = require("hardhat");
  return hre.network.name !== "baseSepolia";
};

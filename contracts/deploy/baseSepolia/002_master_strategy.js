/**
 * Base Sepolia testnet (Master side) — MasterWOTokenStrategy impl + proxy.
 *
 * Proxy deployed via CreateX so its address matches the Remote proxy on
 * Sepolia (CREATE3 peer parity is REQUIRED — the adapters dispatch inbound
 * messages to `envelopeSender`, which is the source-side strategy address,
 * and that address must resolve to the destination strategy on the peer
 * chain).
 *
 * The deployer also acts as governor + operator on testnet so initialization
 * runs in a single tx.
 */
const addresses = require("../../utils/addresses");
const { encodeSaltForCreateX } = require("../../utils/deploy");
const createxAbi = require("../../abi/createx.json");

// Salt for the OETHb wOETH V3 testnet strategy pair. See
// `deploy/base/100_oethb_v3_master_proxy.js` for the salt-naming convention
// (same salt on paired chains, different between testnet and production).
const SALT = "OETHb V3 Testnet wOETH Strategy 1";

module.exports = async (hre) => {
  const { ethers, deployments, getNamedAccounts } = hre;
  const { deploy } = deployments;
  const { deployerAddr } = await getNamedAccounts();
  const sDeployer = await ethers.provider.getSigner(deployerAddr);

  console.log(`[baseSepolia] 002_master_strategy — deployer=${deployerAddr}`);

  // --- 1. Deploy strategy proxy at deterministic CreateX address ---
  // Same logic as deployProxyWithCreateX in deployActions.js, inlined so testnet
  // doesn't depend on the production governance plumbing.
  const cCreateX = await ethers.getContractAt(createxAbi, addresses.createX);
  // Fixed "originprotocol" identifier as the salt-prefix address — keeps the salt
  // identical to what the Sepolia (Remote) side would compute.
  const addrForSalt = "0x0000000000006f726967696e70726f746f636f6c";
  const encodedSalt = encodeSaltForCreateX(addrForSalt, false, SALT);

  const ProxyFactory = await ethers.getContractFactory(
    "InitializeGovernedUpgradeabilityProxy"
  );
  const proxyInitCode = ethers.utils.hexConcat([
    ProxyFactory.bytecode,
    ProxyFactory.interface.encodeDeploy([]),
  ]);

  const predictedProxyAddr = await cCreateX[
    "computeCreate2Address(bytes32,bytes32)"
  ](
    ethers.utils.keccak256(
      ethers.utils.solidityPack(
        ["address", "bytes32"],
        [addresses.createX, encodedSalt]
      )
    ),
    ethers.utils.keccak256(proxyInitCode)
  );
  console.log(`Predicted proxy address: ${predictedProxyAddr}`);

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
    console.log(`Deployed MasterWOTokenStrategyProxy at ${proxyAddress}`);
  } else {
    console.log(`Proxy already deployed at ${proxyAddress}`);
  }

  // Persist the address under a deployment artefact so subsequent scripts can
  // resolve it via deployments.get(...). Use the standard hardhat-deploy save.
  await deployments.save("MasterWOTokenStrategyProxy", {
    address: proxyAddress,
    abi: ProxyFactory.interface.format("json"),
  });

  // --- 2. Deploy Master impl ---
  const dVault = await deployments.get("MockOETHbVault");
  const dOToken = await deployments.get("MockOETHb");

  const dMasterImpl = await deploy("MasterWOTokenStrategy", {
    from: deployerAddr,
    args: [
      {
        platformAddress: ethers.constants.AddressZero,
        vaultAddress: dVault.address,
      },
      addresses.baseSepolia.WETH,
      dOToken.address,
    ],
    log: true,
  });
  console.log(`MasterWOTokenStrategy impl: ${dMasterImpl.address}`);

  // --- 3. Initialise the proxy ---
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

module.exports.id = "baseSepolia_002_master_strategy";
module.exports.tags = ["baseSepolia"];
module.exports.dependencies = ["baseSepolia_001_mock_oethb"];
module.exports.skip = async () => {
  const hre = require("hardhat");
  return hre.network.name !== "baseSepolia";
};

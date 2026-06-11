/**
 * Sepolia testnet (Remote side) — RemoteWOTokenStrategy impl + proxy.
 *
 * The proxy is deployed via CreateX with the SAME salt as the Master proxy on
 * Base Sepolia (`"OETHb V3 Testnet wOETH Strategy 1"`). CREATE3 peer parity
 * means both proxies have the same address, which is what the adapter `_deliver`
 * relies on to dispatch to `envelopeSender` on the destination chain.
 */
const addresses = require("../../utils/addresses");
const { encodeSaltForCreateX } = require("../../utils/deploy");
const createxAbi = require("../../abi/createx.json");

const SALT = "OETHb V3 Testnet wOETH Strategy 1";
const ADDR_FOR_SALT = "0x0000000000006f726967696e70726f746f636f6c";
const CONTRACT_CREATION_TOPIC =
  "0xb8fda7e00c6b06a2b54e58521bc5894fee35f1090e5a3bb6390bfe2b98b497f7";

module.exports = async (hre) => {
  const { ethers, deployments } = hre;
  const { deploy } = deployments;
  const { deployerAddr } = await hre.getNamedAccounts();
  const sDeployer = await ethers.provider.getSigner(deployerAddr);

  console.log(`[sepolia] 003_remote_strategy — deployer=${deployerAddr}`);

  // --- 1. Deploy strategy proxy at deterministic CreateX address ---
  const cCreateX = await ethers.getContractAt(createxAbi, addresses.createX);
  const encodedSalt = encodeSaltForCreateX(ADDR_FOR_SALT, false, SALT);

  const ProxyFactory = await ethers.getContractFactory(
    "CrossChainStrategyProxy"
  );
  const proxyInitCode = ethers.utils.hexConcat([
    ProxyFactory.bytecode,
    ProxyFactory.interface.encodeDeploy([deployerAddr]),
  ]);

  // CreateX `_guard` for our "originprotocol" salt prefix (neither msg.sender
  // nor address(0) for the first 20 bytes) hits the else branch:
  //   guardedSalt = keccak256(abi.encode(salt)) == keccak256(salt)  (bytes32)
  const guardedSalt = ethers.utils.keccak256(encodedSalt);
  const predictedProxyAddr = await cCreateX[
    "computeCreate2Address(bytes32,bytes32)"
  ](guardedSalt, ethers.utils.keccak256(proxyInitCode));
  console.log(`Predicted proxy address: ${predictedProxyAddr}`);

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
    console.log(`Deployed RemoteWOTokenStrategyProxy at ${proxyAddress}`);
  } else {
    console.log(`Proxy already deployed at ${proxyAddress}`);
  }

  await deployments.save("RemoteWOTokenStrategyProxy", {
    address: proxyAddress,
    abi: ProxyFactory.interface.format("json"),
  });

  // --- 2. Deploy Remote impl ---
  const dOTokenVault = await deployments.get("MockOETHVault");
  const dOToken = await deployments.get("MockOETH");
  const dWOToken = await deployments.get("MockWOETH");

  const dRemoteImpl = await deploy("RemoteWOTokenStrategy", {
    from: deployerAddr,
    args: [
      {
        // platformAddress = woToken (per Remote constructor invariant)
        platformAddress: dWOToken.address,
        // vaultAddress must be 0 on Remote (it's not registered with any vault).
        vaultAddress: ethers.constants.AddressZero,
      },
      addresses.sepolia.WETH, // bridgeAsset
      dOToken.address, // oToken
      dWOToken.address, // woToken
      dOTokenVault.address, // oTokenVault
    ],
    log: true,
  });
  console.log(`RemoteWOTokenStrategy impl: ${dRemoteImpl.address}`);

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
      [deployerAddr] // operator = deployer on testnet
    );
    const tx = await cProxy["initialize(address,address,bytes)"](
      dRemoteImpl.address,
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

module.exports.id = "sepolia_003_remote_strategy";
module.exports.tags = ["sepolia"];
module.exports.dependencies = ["sepolia_002_mock_woeth"];
module.exports.skip = async () => {
  const hre = require("hardhat");
  return hre.network.name !== "sepolia";
};

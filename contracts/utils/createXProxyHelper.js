const addresses = require("./addresses");
const { encodeSaltForCreateX } = require("./deploy");
const createxAbi = require("../abi/createx.json");

/// CreateX `ContractCreation` event topic — `keccak256("ContractCreation(address,bytes32)")`.
const CONTRACT_CREATION_TOPIC =
  "0xb8fda7e00c6b06a2b54e58521bc5894fee35f1090e5a3bb6390bfe2b98b497f7";

/// Placeholder address used as the salt-prefix input to CreateX. Same string
/// on every chain so the resulting salt is identical, which keeps the
/// deployed address identical too. The string is "originprotocol" packed
/// into 20 bytes.
const ADDR_FOR_SALT = "0x0000000000006f726967696e70726f746f636f6c";

/**
 * Deploy a `BridgeAdapterProxy` at a CREATE3-deterministic address.
 *
 * The proxy's initcode contains only the `governor = deployer` constructor
 * arg. Both `salt` and `deployerAddr` are required to be the same on each
 * paired chain so the resulting CREATE2 address matches — this is the
 * peer-parity precondition for the `transportSender == address(this)` check
 * on inbound adapter callbacks.
 *
 * Idempotent: re-running on an already-deployed proxy is a no-op (returns
 * the existing address). The deployments artifact is also saved under
 * `saveAs` so subsequent scripts can `deployments.get(saveAs)` to resolve.
 *
 * @param {HardhatRuntimeEnvironment} hre
 * @param {string} saveAs — deployment artifact name (e.g. "CCIPAdapter").
 * @param {string} salt — human-readable salt string (e.g. "OETHb V3 Testnet CCIPAdapter Proxy 1").
 * @returns {Promise<string>} The proxy address.
 */
async function deployBridgeAdapterProxy(hre, saveAs, salt) {
  const { ethers, deployments } = hre;
  const { deployerAddr } = await hre.getNamedAccounts();
  const sDeployer = await ethers.provider.getSigner(deployerAddr);
  const cCreateX = await ethers.getContractAt(createxAbi, addresses.createX);

  const ProxyFactory = await ethers.getContractFactory("BridgeAdapterProxy");
  const proxyInitCode = ethers.utils.hexConcat([
    ProxyFactory.bytecode,
    ProxyFactory.interface.encodeDeploy([deployerAddr]),
  ]);
  const encodedSalt = encodeSaltForCreateX(ADDR_FOR_SALT, false, salt);
  const guardedSalt = ethers.utils.keccak256(
    ethers.utils.solidityPack(
      ["address", "bytes32"],
      [addresses.createX, encodedSalt]
    )
  );
  const predicted = await cCreateX["computeCreate2Address(bytes32,bytes32)"](
    guardedSalt,
    ethers.utils.keccak256(proxyInitCode)
  );

  if ((await ethers.provider.getCode(predicted)) === "0x") {
    const tx = await cCreateX
      .connect(sDeployer)
      .deployCreate2(encodedSalt, proxyInitCode);
    const receipt = await tx.wait();
    const deployed = ethers.utils.getAddress(
      `0x${receipt.events
        .find((e) => e.topics[0] === CONTRACT_CREATION_TOPIC)
        .topics[1].slice(26)}`
    );
    if (deployed.toLowerCase() !== predicted.toLowerCase()) {
      throw new Error(`${saveAs}: predicted ${predicted}, got ${deployed}`);
    }
    console.log(`Deployed ${saveAs} (proxy) at ${deployed}`);
  } else {
    console.log(`${saveAs} (proxy) already at ${predicted}`);
  }

  await deployments.save(saveAs, {
    address: predicted,
    abi: ProxyFactory.interface.format("json"),
  });
  return predicted;
}

/**
 * Point a freshly-deployed `BridgeAdapterProxy` at its impl.
 *
 * The proxy's `initialize(impl, governor, data)` is `onlyGovernor`. The
 * proxy's constructor already set governor = deployer, so the deployer
 * calls this. `data = "0x"` because adapters need no init beyond the
 * proxy storage state — every other field (authorise, lane config, caps,
 * threshold) gets configured by the per-adapter wire script.
 *
 * Idempotent: skips if the proxy already has an implementation set.
 *
 * @param {HardhatRuntimeEnvironment} hre
 * @param {string} proxyAddr
 * @param {string} implAddr
 */
async function initBridgeAdapterProxy(hre, proxyAddr, implAddr) {
  const { ethers } = hre;
  const { deployerAddr } = await hre.getNamedAccounts();
  const sDeployer = await ethers.provider.getSigner(deployerAddr);
  const cProxy = await ethers.getContractAt(
    "InitializeGovernedUpgradeabilityProxy",
    proxyAddr,
    sDeployer
  );
  const current = await cProxy.implementation();
  if (current === ethers.constants.AddressZero) {
    const tx = await cProxy["initialize(address,address,bytes)"](
      implAddr,
      deployerAddr,
      "0x"
    );
    await tx.wait();
    console.log(`  → proxy initialised, impl=${implAddr}`);
  } else {
    console.log(`  → proxy already initialised, impl=${current}`);
  }
}

module.exports = {
  deployBridgeAdapterProxy,
  initBridgeAdapterProxy,
};

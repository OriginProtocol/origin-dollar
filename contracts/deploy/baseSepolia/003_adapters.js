/**
 * Base Sepolia testnet (Master side) — adapter deployments.
 *
 * Two adapters, both deployed via CreateX with deterministic salts so addresses
 * match the Sepolia (Remote) side:
 *   - CCIPAdapter (outbound B→E): Master sends DEPOSIT / WITHDRAW_REQUEST /
 *     WITHDRAW_CLAIM / BALANCE_CHECK_REQUEST / SETTLE messages here.
 *   - SuperbridgeAdapter (inbound E→B, L2 mode): Master receives DEPOSIT_ACK /
 *     WITHDRAW_REQUEST_ACK / WITHDRAW_CLAIM_ACK (with WETH) / BALANCE_CHECK_RESPONSE /
 *     SETTLE_ACK here. L2-side mode → `_l1 = address(0)` (no canonical outbound;
 *     incoming ETH from L1StandardBridge is wrapped to WETH via `receive()`).
 */
const addresses = require("../../utils/addresses");
const { encodeSaltForCreateX } = require("../../utils/deploy");
const createxAbi = require("../../abi/createx.json");

const CCIP_SALT = "OETHb V3 Testnet CCIPAdapter";
const SUPER_SALT = "OETHb V3 Testnet SuperbridgeAdapter";

const CONTRACT_CREATION_TOPIC =
  "0xb8fda7e00c6b06a2b54e58521bc5894fee35f1090e5a3bb6390bfe2b98b497f7";
const ADDR_FOR_SALT = "0x0000000000006f726967696e70726f746f636f6c";

async function deployViaCreateX(hre, name, args, salt) {
  const { ethers, deployments } = hre;
  const { deployerAddr } = await hre.getNamedAccounts();
  const sDeployer = await ethers.provider.getSigner(deployerAddr);
  const cCreateX = await ethers.getContractAt(createxAbi, addresses.createX);
  const encodedSalt = encodeSaltForCreateX(ADDR_FOR_SALT, false, salt);

  const Factory = await ethers.getContractFactory(name);
  const initCode = ethers.utils.hexConcat([
    Factory.bytecode,
    Factory.interface.encodeDeploy(args),
  ]);

  // computeCreate2Address(bytes32 salt, bytes32 initCodeHash) on CreateX
  const guardedSalt = ethers.utils.keccak256(
    ethers.utils.solidityPack(
      ["address", "bytes32"],
      [addresses.createX, encodedSalt]
    )
  );
  const predicted = await cCreateX["computeCreate2Address(bytes32,bytes32)"](
    guardedSalt,
    ethers.utils.keccak256(initCode)
  );

  const existing = await ethers.provider.getCode(predicted);
  if (existing !== "0x") {
    console.log(`${name} already deployed at ${predicted}`);
  } else {
    const tx = await cCreateX
      .connect(sDeployer)
      .deployCreate2(encodedSalt, initCode);
    const receipt = await tx.wait();
    const deployedAddr = ethers.utils.getAddress(
      `0x${receipt.events
        .find((e) => e.topics[0] === CONTRACT_CREATION_TOPIC)
        .topics[1].slice(26)}`
    );
    if (deployedAddr.toLowerCase() !== predicted.toLowerCase()) {
      throw new Error(
        `Address mismatch: predicted ${predicted}, got ${deployedAddr}`
      );
    }
    console.log(`Deployed ${name} at ${deployedAddr}`);
  }

  // Save deployment artifact so later scripts can `deployments.get(name)`.
  await deployments.save(name, {
    address: predicted,
    abi: Factory.interface.format("json"),
  });

  return predicted;
}

module.exports = async (hre) => {
  const { deployerAddr } = await hre.getNamedAccounts();
  console.log(`[baseSepolia] 003_adapters — deployer=${deployerAddr}`);

  // --- 1. CCIPAdapter (outbound B→E) ---
  await deployViaCreateX(
    hre,
    "CCIPAdapter",
    [addresses.baseSepolia.CCIPRouter],
    CCIP_SALT
  );

  // --- 2. SuperbridgeAdapter (inbound E→B, L2 mode) ---
  // _l1 = 0 (L2 side never sends to canonical bridge — outbound entry points revert).
  // _ccipRouter = local Base Sepolia CCIP router (for the message leg of inbound delivery).
  // _localWETH = Base Sepolia WETH (wraps incoming bridged ETH in receive()).
  await deployViaCreateX(
    hre,
    "SuperbridgeAdapter",
    [
      hre.ethers.constants.AddressZero,
      addresses.baseSepolia.CCIPRouter,
      addresses.baseSepolia.WETH,
    ],
    SUPER_SALT
  );

  return true;
};

module.exports.id = "baseSepolia_003_adapters";
module.exports.tags = ["baseSepolia"];
module.exports.dependencies = ["baseSepolia_002_master_strategy"];
module.exports.skip = async () => {
  const hre = require("hardhat");
  return hre.network.name !== "baseSepolia";
};

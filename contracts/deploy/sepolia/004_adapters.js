/**
 * Sepolia testnet (Remote side) — adapter deployments.
 *
 * Two adapters, both at the SAME CreateX salts as Base Sepolia — peer parity:
 *   - CCIPAdapter (inbound B→E): Remote receives DEPOSIT / WITHDRAW_REQUEST /
 *     WITHDRAW_CLAIM / BALANCE_CHECK_REQUEST / SETTLE messages here.
 *   - SuperbridgeAdapter (outbound E→B, L1 mode): Remote sends ack messages
 *     (DEPOSIT_ACK, WITHDRAW_*_ACK, BALANCE_CHECK_RESPONSE, SETTLE_ACK) and
 *     WITHDRAW_CLAIM_ACK with WETH via split delivery (CCIP message + L1
 *     standard bridge ETH leg).
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

  await deployments.save(name, {
    address: predicted,
    abi: Factory.interface.format("json"),
  });

  return predicted;
}

module.exports = async (hre) => {
  const { deployerAddr } = await hre.getNamedAccounts();
  console.log(`[sepolia] 004_adapters — deployer=${deployerAddr}`);

  // --- 1. CCIPAdapter (inbound B→E for yield channel, also outbound for bridge channel) ---
  await deployViaCreateX(
    hre,
    "CCIPAdapter",
    [addresses.sepolia.CCIPRouter],
    CCIP_SALT
  );

  // --- 2. SuperbridgeAdapter (outbound E→B, L1 mode) ---
  // _l1 = L1StandardBridge for Base Sepolia rollup (canonical ETH leg).
  // _ccipRouter = local Sepolia CCIP router.
  // _localWETH = Sepolia WETH (unwrapped before passing ETH into the canonical bridge).
  await deployViaCreateX(
    hre,
    "SuperbridgeAdapter",
    [
      addresses.sepolia.BaseSepoliaL1StandardBridge,
      addresses.sepolia.CCIPRouter,
      addresses.sepolia.WETH,
    ],
    SUPER_SALT
  );

  return true;
};

module.exports.id = "sepolia_004_adapters";
module.exports.tags = ["sepolia"];
module.exports.dependencies = ["sepolia_003_remote_strategy"];
module.exports.skip = async () => {
  const hre = require("hardhat");
  return hre.network.name !== "sepolia";
};

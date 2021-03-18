// Script for sending a governance proposal.
// This can be sent by any account, but the script uses the deployer account
// for simplicity since it is already configured in Hardhat.
//
// Usage:
//  - Setup your environment
//      export HARDHAT_NETWORK=mainnet
//      export DEPLOYER_PK=<pk>
//      export GAS_PRICE_MULTIPLIER=<multiplier> e.g. 1.1
//      export PROVIDER_URL=<url>
//  - Run:
//      node propose.js --<action>
//

const { ethers, getNamedAccounts } = require("hardhat");
const { utils } = require("ethers");

const { isMainnet, isRinkeby } = require("../../test/helpers.js");
const { proposeArgs } = require("../../utils/governor");
const { getTxOpts } = require("../../utils/tx");
const addresses = require("../../utils/addresses");

const REGISTER = "register";
const DEPOSIT = "deposit";
const WITHDRAW = "withdraw";

const KOVAN = "kovan";

function getRegistryContract(network) {
  let keeperLinkRegistryAddr;
  switch (network) {
    case KOVAN:
      keeperLinkRegistryAddr = "0xAaaD7966EBE0663b8C9C6f683FB9c3e66E03467F";
      break;
    default:
      throw new Error(`Unknown network: ${network}.`);
  }

  const KeeperLinkRegistryABI = [
    "function registerUpkeep(address target, uint32 gasLimit, address admin, bytes calldata checkData) external returns ( uint256 id)",
    "function addFunds(uint256 id, uint96 amount) external",
    "function withdrawFunds(uint256 id, address to) external",
  ];
  const keeperRegistry = new ethers.Contract(
    keeperLinkRegistryAddr,
    KeeperLinkRegistryABI,
    ethers.provider
  );

  return keeperRegistry;
}

async function register(keeperRegistry) {}

async function deposit(keeperRegistry) {}

async function withdraw(keeperRegistry) {}

async function main() {
  const { deployerAddr } = await getNamedAccounts();
  const sDeployer = ethers.provider.getSigner(deployerAddr);

  var action = process.argv[2];
  var id = process.argv[3];
  var network = process.argv[4];

  if (
    !action ||
    ![REGISTER, DEPOSIT, WITHDRAW].includes(action.toLowerCase())
  ) {
    throw Error(
      `The value: ${action} is not valid. You must enter one of the three actions: ${REGISTER}, ${DEPOSIT}, ${WITHDRAW}.`
    );
  }

  if (!network || ![KOVAN].includes(network.toLowerCase())) {
    throw Error(
      `The value: ${network} is not valid. You must enter one of the networks: ${KOVAN}.`
    );
  }

  if (!id || !Number(id)) {
    throw Error(
      `The value: ${id} is not valid. You must enter the numeric id of your keeper task: ie. 123456`
    );
  }

  const keeperRegistry = getRegistryContract(network);

  switch (action.toLowerCase()) {
    case REGISTER:
      console.log(`${action} with id: ${id}`);
      break;
    case DEPOSIT:
      console.log(`${action} with id: ${id}`);
      break;
    case WITHDRAW:
      console.log(`${action} with id: ${id}`);
      break;
    default:
      throw new Error(`Unknown action: ${action} with id: ${id}`);
  }
}

// Run the job.
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

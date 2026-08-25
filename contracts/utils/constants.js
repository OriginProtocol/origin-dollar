const ethers = require("ethers");

const MAX_UINT256 = ethers.BigNumber.from(
  "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff"
);
const MAX_UINT64 = ethers.BigNumber.from("0xffffffffffffffff");
const ZERO_BYTES32 = ethers.utils.hexZeroPad("0x", 32);

const ONE = ethers.utils.parseEther("1");

const oethPoolLpPID = 174;

// chain selectors for CCIP
const ccip_arbChainSelector = "4949039107694359620";

const beaconChainGenesisTimeMainnet = 1606824023; // Tue Dec 01 2020 12:00:23 GMT+0000
const beaconChainGenesisTimeHoodi = 1742213400; //	Mon Mar 17 2025 12:10:00 GMT+0000

const gIndexFirstPendingDepositPubKey = 1584842932224n;
const gIndexFirstPendingDepositSlot = 1584842932228n;

module.exports = {
  oethPoolLpPID,
  MAX_UINT256,
  MAX_UINT64,
  ZERO_BYTES32,
  ccip_arbChainSelector,
  ONE,
  beaconChainGenesisTimeMainnet,
  beaconChainGenesisTimeHoodi,
  gIndexFirstPendingDepositPubKey,
  gIndexFirstPendingDepositSlot,
};

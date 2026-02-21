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

// set this value to "ecdhPublicKey" field in P2P's ssv-request-create
const p2pApiEncodedKey =
  "LS0tLS1CRUdJTiBQVUJMSUMgS0VZLS0tLS0KTUZrd0V3WUhLb1pJemowQ0FRWUlLb1pJemowREFRY0RRZ0FFVEcydGNwUWxHaEpQdlF3K2prZ1NmU2N3RjBDTgpUNEUva1ZXaWFWeVdLWkRFRXgvOWVWenNIc2FRQU5tbEJNV1pMbHhXQVhRWno2Qy9YQWN0bU56Y1BRPT0KLS0tLS1FTkQgUFVCTElDIEtFWS0tLS0tCg==";

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
  p2pApiEncodedKey,
  ONE,
  beaconChainGenesisTimeMainnet,
  beaconChainGenesisTimeHoodi,
  gIndexFirstPendingDepositPubKey,
  gIndexFirstPendingDepositSlot,
};

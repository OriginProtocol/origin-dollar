const threeCRVPid = 9;
const metapoolLPCRVPid = 56;
const musdMetapoolLPCRVPid = 14;
const fraxMetapoolLPCRVPid = 32;
const alusdMetapoolLPCRVPid = 36;
const usddMetapoolLPCRVPid = 96;
const { BigNumber } = require("ethers");
const MAX_UINT256 = BigNumber.from(
  "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff"
);

module.exports = {
  threeCRVPid,
  metapoolLPCRVPid,
  musdMetapoolLPCRVPid,
  fraxMetapoolLPCRVPid,
  alusdMetapoolLPCRVPid,
  usddMetapoolLPCRVPid,
  MAX_UINT256,
};

const addresses = require("../utils/addresses");
const { ethers } = require("ethers");
const passThroughAbi = require("../../abi/passThrough.json");
const { logTxDetails } = require("../utils/txLogger");

async function transferTokens({ signer }) {
  const OUSD = addresses.mainnet.OUSDProxy;
  const OETH = addresses.mainnet.OETHProxy;

  // Map tokens to their passThrough contracts
  const tokenPassThroughs = {
    [OUSD]: [
      addresses.mainnet.passthrough.curve.OUSD_3POOL, // OUSD/3pool Curve pool
      addresses.mainnet.passthrough.uniswap.OUSD_USDT, // OUSD/USDT  Uniswap pool
    ],
    [OETH]: [
      addresses.mainnet.passthrough.uniswap.OETH_OGN, // OGN/OETH   Uniswap pool
      addresses.mainnet.passthrough.uniswap.OETH_WETH, // OETH/WETH  Uniswap pool
    ],
  };

  console.log("DEBUG: Token PassThroughs mapping", tokenPassThroughs);

  // Process all tokens and their passThrough contracts
  for (const [token, passThroughAddresses] of Object.entries(
    tokenPassThroughs
  )) {
    const tokenName = token === OUSD ? "OUSD" : "OETH";

    for (const passThroughAddress of passThroughAddresses) {
      const passThrough = new ethers.Contract(
        passThroughAddress,
        passThroughAbi,
        signer
      );

      const tx = await passThrough.connect(signer).passThroughTokens([token]);
      await logTxDetails(
        tx,
        `PassThrough at ${passThroughAddress} sent ${tokenName}`
      );
    }
  }
}

module.exports = {
  transferTokens,
};

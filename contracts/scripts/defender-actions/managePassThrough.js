const { ethers } = require("ethers");
const {
  DefenderRelaySigner,
  DefenderRelayProvider,
} = require("@openzeppelin/defender-relay-client/lib/ethers");

const passThroughAbi = require("../../abi/passThrough.json");
const { logTxDetails } = require("../../utils/txLogger");

// Entrypoint for the Defender Action
const handler = async (event) => {
  console.log(
    `DEBUG env var in handler before being set: "${process.env.DEBUG}"`
  );

  // Initialize defender relayer provider and signer
  const provider = new DefenderRelayProvider(event);
  const signer = new DefenderRelaySigner(event, provider, { speed: "fastest" });

  const OUSD = "0x2A8e1E676Ec238d8A992307B495b45B3fEAa5e86";
  const OETH = "0x856c4Efb76C1D1AE02e20CEB03A2A6a08b0b8dC3";

  // Map tokens to their passThrough contracts
  const tokenPassThroughs = {
    [OUSD]: [
      "0x261Fe804ff1F7909c27106dE7030d5A33E72E1bD", // OUSD/3pool Curve pool
      "0xF29c14dD91e3755ddc1BADc92db549007293F67b", // OUSD/USDT  Uniswap pool
    ],
    [OETH]: [
      "0x2D3007d07aF522988A0Bf3C57Ee1074fA1B27CF1", // OGN/OETH   Uniswap pool
      "0x216dEBBF25e5e67e6f5B2AD59c856Fc364478A6A", // OETH/WETH  Uniswap pool
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
};

module.exports = { handler };

require("dotenv").config();

async function env() {
  const envVars = ["PROVIDER_URL", "DEPLOYER_PK", "GOVERNOR_PK"];
  for (const envVar of envVars) {
    if (!process.env[envVar]) {
      throw new Error(`For Mainnet deploy env var ${envVar} must be defined.`);
    }
  }

  if (process.env.GAS_PRICE_MULTIPLIER) {
    const value = Number(process.env.GAS_PRICE_MULTIPLIER);
    if (value < 1 || value > 2) {
      throw new Error(`Check GAS_PRICE_MULTIPLIER. Value out of range.`);
    }
  }
  console.log("All good. Deploy away!");
}

module.exports = {
  env,
};

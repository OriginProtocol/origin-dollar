const { isMainnet, isFork, isSmokeTest } = require("../test/helpers.js");
const {
  log,
  deployWithConfirmation,
  withConfirmation,
} = require("../utils/deploy");
const { getTxOpts } = require("../utils/tx");
const { impersonateAndFund } = require("../utils/signers.js");

const deployName = "015_flipper";

/**
 * Deploys the flipper contract on Fork, Mainnet.
 */
const trustee = async (hre) => {
  console.log(`Running ${deployName} deployment...`);

  const { governorAddr, strategistAddr } = await hre.getNamedAccounts();
  log(`Using governor ${governorAddr} and strategist ${strategistAddr}`);

  // Deploy the Flipper contract contract.
  await deployWithConfirmation("Flipper");

  // Transfer governance.
  const cFlipper = await ethers.getContract("Flipper");
  if (isMainnet) {
    await withConfirmation(
      cFlipper.transferGovernance(strategistAddr, await getTxOpts())
    );
    log(
      `Called transferGovernance(${strategistAddr} on Flipper contract at ${cFlipper.address}`
    );
    // On Mainnet, we claim governance manually using the Strategist multi-sig.
    log(
      `Use the Strategist multi-sig at ${strategistAddr} to call claimGovernance() on Flipper contract at ${cFlipper.address}`
    );
  } else {
    let signer;
    if (isFork) {
      signer = await impersonateAndFund(strategistAddr, "100000");
    } else {
      signer = await ethers.provider.getSigner(governorAddr);
    }
    await withConfirmation(
      cFlipper.transferGovernance(await signer.getAddress(), await getTxOpts())
    );
    log(
      `Called transferGovernance(${await signer.getAddress()}) on Flipper contract at ${
        cFlipper.address
      }`
    );

    await withConfirmation(
      cFlipper.connect(signer).claimGovernance(await getTxOpts())
    );
    log(`Claimed governance for ${await signer.getAddress()}`);
  }

  return true;
};

const main = async (hre) => {
  console.log(`Running ${deployName} deployment...`);
  if (!hre) {
    hre = require("hardhat");
  }
  await trustee(hre);
  console.log(`${deployName} deploy done.`);
  return true;
};

main.id = deployName;
main.skip = () => !isMainnet || isSmokeTest || isFork;

module.exports = main;

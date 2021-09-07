const {
  isMainnet,
  isFork,
  isRinkeby,
  isSmokeTest,
} = require("../test/helpers.js");
const {
  log,
  deployWithConfirmation,
  withConfirmation,
} = require("../utils/deploy");
const { getTxOpts } = require("../utils/tx");
const addresses = require("../utils/addresses");

const deployName = "015_flipper";

/**
 * Deploys the flipper contract on Rinkeby, Fork, Mainnet.
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
      // On Fork we impersonate the Strategist to claim governance.
      await hre.network.provider.request({
        method: "hardhat_impersonateAccount",
        params: [strategistAddr],
      });
      signer = await ethers.provider.getSigner(strategistAddr);

      // Send some Eth to the signer to pay for gas fees.
      await hre.network.provider.request({
        method: "hardhat_impersonateAccount",
        params: [addresses.mainnet.Binance],
      });
      const binanceSigner = await ethers.provider.getSigner(
        addresses.mainnet.Binance
      );
      // Send some Ethereum to Governor
      await binanceSigner.sendTransaction({
        to: strategistAddr,
        value: hre.ethers.utils.parseEther("100"),
      });
    } else {
      // On Rinkeby we claim governance using the governor account.
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
main.skip = () => !(isMainnet || isRinkeby) || isSmokeTest || isFork;

module.exports = main;

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

const deployName = "016_keeper";

/**
 * Deploys the Keeper contract on Kovan, Fork, Mainnet.
 */
const trustee = async (hre) => {
  console.log(`Running ${deployName} deployment...`);

  const { governorAddr, strategistAddr } = await hre.getNamedAccounts();
  log(`Using governor ${governorAddr} and strategist ${strategistAddr}`);

  const cOUSDProxy = await ethers.getContract("OUSDProxy");
  const cVaultCoreProxy = await ethers.getContract("VaultProxy");

  // Deploy the Keeper contract.
  await deployWithConfirmation("Upkeep", [
    cVaultCoreProxy.address,
    cOUSDProxy.address,
  ]);

  // Transfer governance.
  const cKeeper = await ethers.getContract("Upkeep");
  if (isMainnet) {
    await withConfirmation(
      cKeeper.transferGovernance(strategistAddr, await getTxOpts())
    );
    log(
      `Called transferGovernance(${strategistAddr} on Keeper contract at ${cKeeper.address}`
    );
    // On Mainnet, we claim governance manually using the Strategist multi-sig.
    log(
      `Use the Strategist multi-sig at ${strategistAddr} to call claimGovernance() on Keeper contract at ${cKeeper.address}`
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
      // On Kovan we claim governance using the governor account.
      signer = await ethers.provider.getSigner(governorAddr);
    }
    await withConfirmation(
      cKeeper.transferGovernance(await signer.getAddress(), await getTxOpts())
    );
    log(
      `Called transferGovernance(${await signer.getAddress()}) on Keeper contract at ${
        cKeeper.address
      }`
    );

    await withConfirmation(
      cKeeper.connect(signer).claimGovernance(await getTxOpts())
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
main.skip = () => isMainnet || isRinkeby || isFork;

module.exports = main;

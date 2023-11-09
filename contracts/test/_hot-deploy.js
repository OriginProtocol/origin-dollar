/* This file contains functions that hot deploy a contract or a set of contracts. Should/can be
 * used for fork-contract development process where the standalone (separate terminal) node
 * doesn't need to be restarted to pick up code and ABI changes.
 */
const { replaceContractAt } = require("../utils/hardhat");
const addresses = require("../utils/addresses");
const {
  balancer_rETH_WETH_PID,
  balancer_wstETH_sfrxETH_rETH_PID,
  oethPoolLpPID,
} = require("../utils/constants");
const { impersonateAndFund } = require("../utils/signers");
const { ethers } = hre;
const log = require("../utils/logger")("test:fixtures:hot-deploy");

// based on a contract name create new implementation
async function constructNewContract(fixture, implContractName) {
  const { deploy } = deployments;

  const getConstructorArguments = () => {
    if (
      ["BalancerMetaPoolTestStrategy", "BalancerMetaPoolStrategy"].includes(
        implContractName
      )
    ) {
      return [
        [addresses.mainnet.rETH_WETH_BPT, addresses.mainnet.OETHVaultProxy],
        [
          addresses.mainnet.rETH,
          addresses.mainnet.stETH,
          addresses.mainnet.wstETH,
          addresses.mainnet.frxETH,
          addresses.mainnet.sfrxETH,
          addresses.mainnet.balancerVault, // Address of the Balancer vault
          balancer_rETH_WETH_PID, // Pool ID of the Balancer pool
        ],
        addresses.mainnet.rETH_WETH_AuraRewards, // Address of the Aura rewards contract
      ];
    } else if (implContractName === "BalancerComposablePoolTestStrategy") {
      return [
        [
          addresses.mainnet.wstETH_sfrxETH_rETH_BPT,
          addresses.mainnet.OETHVaultProxy,
        ],
        [
          addresses.mainnet.rETH,
          addresses.mainnet.stETH,
          addresses.mainnet.wstETH,
          addresses.mainnet.frxETH,
          addresses.mainnet.sfrxETH,
          addresses.mainnet.balancerVault, // Address of the Balancer vault
          balancer_wstETH_sfrxETH_rETH_PID, // Pool ID of the Balancer pool
        ],
        addresses.mainnet.wstETH_sfrxETH_rETH_AuraRewards, // Address of the Aura rewards contract
      ];
    } else if (implContractName === "MorphoCompoundStrategy") {
      return [
        [
          addresses.zero, // platformAddres not used by the strategy
          addresses.mainnet.VaultProxy,
        ],
      ];
    } else if (implContractName === "FraxETHStrategy") {
      return [
        [addresses.mainnet.sfrxETH, addresses.mainnet.OETHVaultProxy],
        addresses.mainnet.frxETH,
      ];
    } else if (implContractName === "ConvexEthMetaStrategy") {
      return [
        [addresses.mainnet.CurveOETHMetaPool, addresses.mainnet.OETHVaultProxy],
        [
          addresses.mainnet.CVXBooster,
          addresses.mainnet.CVXETHRewardsPool,
          oethPoolLpPID,
          addresses.mainnet.OETHProxy,
          addresses.mainnet.WETH,
        ],
      ];
    } else if (implContractName === "FraxConvexStrategy") {
      return [
        [
          addresses.mainnet.CurveFrxEthWethPool,
          addresses.mainnet.OETHVaultProxy,
        ],
        [
          2, //assets in the Curve pool
          addresses.mainnet.CurveFrxEthWethPool, // Curve pool
          addresses.mainnet.CurveFrxEthWethPool, // Curve LP token
        ],
        [
          // stkcvxfrxeth-ng-f-frax
          addresses.mainnet.FraxStakedConvexWrapperWeth,
          // locked stkcvxfrxeth-ng-f-frax
          addresses.mainnet.LockedFraxStakedConvexWeth,
        ],
      ];
    }
  };

  log(`Deploying new "${implContractName}" contract implementation.`);

  // deploy this contract that exposes internal function
  await deploy(implContractName, {
    from: addresses.mainnet.Timelock, // doesn't matter which address deploys it
    contract: implContractName,
    args: getConstructorArguments(),
  });

  log(`Deployed`);
  return await ethers.getContract(implContractName);
}

/* Hot deploy a fixture if the environment vars demand so
 */
async function hotDeployOption(
  fixture,
  fixtureName,
  config = { isOethFixture: false }
) {
  const hotDeployOptions = (process.env.HOT_DEPLOY || "")
    .split(",")
    .map((item) => item.trim());
  const { isOethFixture } = config;
  const deployStrat = hotDeployOptions.includes("strategy");
  const deployVaultCore = hotDeployOptions.includes("vaultCore");
  const deployVaultAdmin = hotDeployOptions.includes("vaultAdmin");
  const deployHarvester = hotDeployOptions.includes("harvester");

  console.log("isOethFixture", isOethFixture);

  log(`Running fixture hot deployment w/ config; isOethFixture:${isOethFixture} strategy:${!!deployStrat} 
    vaultCore:${!!deployVaultCore} vaultAdmin:${!!deployVaultAdmin} harvester:${!!deployHarvester}`);

  if (deployStrat) {
    if (fixtureName === "balancerREthFixture") {
      await hotDeployFixture(
        fixture, // fixture
        "balancerREthStrategy", // fixtureStrategyVarName
        "BalancerMetaPoolStrategy" // implContractName
      );
    } else if (fixtureName === "morphoCompoundFixture") {
      await hotDeployFixture(
        fixture, // fixture
        "morphoCompoundStrategy", // fixtureStrategyVarName
        "MorphoCompoundStrategy" // implContractName
      );
    } else if (fixtureName === "fraxETHStrategyFixture") {
      await hotDeployFixture(
        fixture, // fixture
        "fraxEthStrategy", // fixtureStrategyVarName
        "FraxETHStrategy" // implContractName
      );
    } else if (fixtureName === "convexOETHMetaVaultFixture") {
      await hotDeployFixture(
        fixture, // fixture
        "convexEthMetaStrategy", // fixtureStrategyVarName
        "ConvexEthMetaStrategy" // implContractName
      );
    } else if (fixtureName === "fraxConvexWethFixture") {
      await hotDeployFixture(
        fixture, // fixture
        "fraxConvexWethStrategy", // fixtureStrategyVarName
        "FraxConvexStrategy" // implContractName
      );
    }
  }

  if (deployVaultCore || deployVaultAdmin) {
    await hotDeployVaultAdmin(
      fixture,
      deployVaultAdmin,
      deployVaultCore,
      isOethFixture
    );
  }
  if (deployHarvester) {
    // TODO: update harvester
  }
}

async function hotDeployVaultAdmin(
  fixture,
  deployVaultAdmin,
  deployVaultCore,
  isOeth
) {
  const { deploy } = deployments;
  const vaultProxyName = `${isOeth ? "OETH" : ""}VaultProxy`;
  const vaultCoreName = `${isOeth ? "OETH" : ""}VaultCore`;
  const vaultAdminName = `${isOeth ? "OETH" : ""}VaultAdmin`;

  const cVaultProxy = await ethers.getContract(vaultProxyName);

  if (deployVaultAdmin) {
    log(`Deploying new ${vaultAdminName} implementation`);

    // deploy this contract that exposes internal function
    await deploy(vaultAdminName, {
      from: addresses.mainnet.Timelock, // doesn't matter which address deploys it
      contract: vaultAdminName,
    });

    const implementation = await ethers.getContract(vaultAdminName);
    const cVault = await ethers.getContractAt(
      vaultCoreName,
      cVaultProxy.address
    );
    // TODO: this might be faster by replacing bytecode of existing implementation contract
    const signerTimelock = await impersonateAndFund(addresses.mainnet.Timelock);
    await cVault.connect(signerTimelock).setAdminImpl(implementation.address);
  }
  if (deployVaultCore) {
    log(`Deploying new ${vaultCoreName} implementation`);
    // deploy this contract that exposes internal function
    await deploy(vaultCoreName, {
      from: addresses.mainnet.Timelock, // doesn't matter which address deploys it
      contract: vaultCoreName,
    });
    const implementation = await ethers.getContract(vaultCoreName);

    const cVault = await ethers.getContractAt(
      "InitializeGovernedUpgradeabilityProxy",
      cVaultProxy.address
    );
    const liveImplContractAddress = await cVault.implementation();

    log(
      `Replacing implementation at ${liveImplContractAddress} with the fresh bytecode`
    );

    await replaceContractAt(liveImplContractAddress, implementation);
  }
}

/* Run the fixture and replace the main strategy contract(s) of the fixture
 * with the freshly compiled implementation.
 */
async function hotDeployFixture(
  fixture,
  fixtureStrategyVarName,
  implContractName
) {
  /* Because of the way hardhat fixture caching works it is vital that
   * the fixtures are loaded before the hot-deployment of contracts. If the
   * contracts are hot-deployed and fixture load happens afterwards the deployed
   * contract is not visible in deployments.
   */
  const strategyProxy = fixture[fixtureStrategyVarName];

  const newlyCompiledImplContract = await constructNewContract(
    fixture,
    implContractName
  );
  log(`New contract deployed at ${newlyCompiledImplContract.address}`);

  // fetch the contract with proxy ABI
  const proxyContract = await ethers.getContractAt(
    "InitializeGovernedUpgradeabilityProxy",
    strategyProxy.address
  );

  const liveImplContractAddress = await proxyContract.implementation();

  log(
    `Replacing implementation at ${liveImplContractAddress} with the fresh bytecode`
  );
  // replace current implementation
  await replaceContractAt(liveImplContractAddress, newlyCompiledImplContract);

  return fixture;
}

module.exports = {
  hotDeployOption,
};

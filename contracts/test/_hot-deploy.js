/* This file contains functions that hot deploy a contract or a set of contracts. Should/can be
 * used for fork-contract development process where the standalone (separate terminal) node
 * doesn't need to be restarted to pick up code and ABI changes.
 */
const { ethers } = hre;

const { isFork, isCI } = require("./helpers");
const addresses = require("../utils/addresses");
const {
  balancer_rETH_WETH_PID,
  balancer_wstETH_sfrxETH_rETH_PID,
  oethPoolLpPID,
} = require("../utils/constants");
const { replaceContractAt } = require("../utils/hardhat");

const log = require("../utils/logger")("test:fixtures:hot-deploy");

// based on a contract name create new implementation
async function constructNewContract(
  fixture,
  fixtureStrategyVarName,
  implContractName
) {
  const { deploy } = deployments;

  const getConstructorArguments = async () => {
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
    } else if (implContractName === "NativeStakingSSVStrategy") {
      const feeAccumulatorAddress = await fixture[
        fixtureStrategyVarName
      ].FEE_ACCUMULATOR_ADDRESS();
      return [
        [addresses.zero, addresses.mainnet.OETHVaultProxy],
        addresses.mainnet.WETH,
        addresses.mainnet.SSV,
        addresses.mainnet.SSVNetwork,
        500,
        feeAccumulatorAddress,
        addresses.mainnet.beaconChainDepositContract,
      ];
    }
  };

  log(`Deploying new "${implContractName}" contract implementation.`);

  // deploy this contract that exposes internal function
  await deploy(implContractName, {
    from: addresses.mainnet.Timelock, // doesn't matter which address deploys it
    contract: implContractName,
    args: await getConstructorArguments(),
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
  // Disable Hot Deploy on CI and for unit tests
  if (!isFork || isCI) return;

  const hotDeployOptions = (process.env.HOT_DEPLOY || "")
    .split(",")
    .map((item) => item.trim());

  if (!hotDeployOptions.length) return;

  const { isOethFixture } = config;
  const deployStrat = hotDeployOptions.includes("strategy");
  const deployVaultCore = hotDeployOptions.includes("vaultCore");
  const deployVaultAdmin = hotDeployOptions.includes("vaultAdmin");
  const deployHarvester = hotDeployOptions.includes("harvester");
  const deployOracleRouter = hotDeployOptions.includes("oracleRouter");
  const deployBuyback = hotDeployOptions.includes("buyback");

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
    } else if (fixtureName === "convexOETHMetaVaultFixture") {
      await hotDeployFixture(
        fixture, // fixture
        "convexEthMetaStrategy", // fixtureStrategyVarName
        "ConvexEthMetaStrategy" // implContractName
      );
    } else if (fixtureName === "nativeStakingSSVStrategyFixture") {
      await hotDeployFixture(
        fixture, // fixture
        "nativeStakingSSVStrategy", // fixtureStrategyVarName
        "NativeStakingSSVStrategy" // implContractName
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
    await hotDeployHarvester(fixture, isOethFixture);
  }
  if (deployOracleRouter) {
    await hotDeployOracleRouter(fixture, isOethFixture);
  }

  if (deployBuyback) {
    await hotDeployBuyback(fixture, isOethFixture);
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
  const vaultVariableName = `${isOeth ? "oethVault" : "vault"}`;

  const cVaultProxy = await ethers.getContract(vaultProxyName);

  if (deployVaultAdmin) {
    log(`Deploying new ${vaultAdminName} implementation`);

    // deploy this contract that exposes internal function
    await deploy(vaultAdminName, {
      from: addresses.mainnet.Timelock, // doesn't matter which address deploys it
      contract: vaultAdminName,
      args: isOeth ? [fixture.weth.address] : [],
    });

    fixture[vaultVariableName] = await ethers.getContractAt(
      "IVault",
      cVaultProxy.address
    );
  }
  if (deployVaultCore) {
    log(`Deploying new ${vaultCoreName} implementation`);
    // deploy this contract that exposes internal function
    await deploy(vaultCoreName, {
      from: addresses.mainnet.Timelock, // doesn't matter which address deploys it
      contract: vaultCoreName,
      args: isOeth ? [fixture.weth.address] : [],
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

async function hotDeployHarvester(fixture, forOETH) {
  const { deploy } = deployments;
  const harvesterName = `${forOETH ? "OETH" : ""}Harvester`;
  const harvesterProxyName = `${forOETH ? "OETH" : ""}HarvesterProxy`;
  const vault = forOETH ? fixture.oethVault : fixture.vault;
  const baseToken = forOETH ? fixture.weth : fixture.usdt;

  const cHarvesterProxy = await ethers.getContract(harvesterProxyName);

  log(`Deploying new ${harvesterName} implementation`);
  await deploy(harvesterName, {
    from: addresses.mainnet.Timelock,
    contract: harvesterName,
    args: [vault.address, baseToken.address],
  });
  const implementation = await ethers.getContract(harvesterName);
  const liveImplContractAddress = await cHarvesterProxy.implementation();
  log(
    `Replacing implementation at ${liveImplContractAddress} with the fresh bytecode`
  );
  await replaceContractAt(liveImplContractAddress, implementation);
}

async function hotDeployOracleRouter(fixture, forOETH) {
  const { deploy } = deployments;
  const routerName = `${forOETH ? "OETH" : ""}OracleRouter`;

  const cRouter = await ethers.getContract(routerName);

  if (forOETH) {
    await deploy("AuraWETHPriceFeed", {
      from: await fixture.strategist.getAddress(),
      args: [addresses.mainnet.AuraWeightedOraclePool],
    });
    const auraPriceFeed = await ethers.getContract("AuraWETHPriceFeed");

    await deploy(routerName, {
      from: await fixture.strategist.getAddress(),
      args: [auraPriceFeed.address],
    });
  } else {
    await deploy(routerName, {
      from: await fixture.strategist.getAddress(),
      args: [],
    });
  }

  const implementation = await ethers.getContract(routerName);
  log(`Replacing implementation at ${cRouter.address} with the fresh bytecode`);
  await replaceContractAt(cRouter.address, implementation);
}

async function hotDeployBuyback(fixture, forOETH) {
  const { deploy } = deployments;
  const proxyName = `${forOETH ? "OETH" : ""}BuybackProxy`;
  const contractName = `${forOETH ? "OETH" : "OUSD"}Buyback`;

  const proxy = await ethers.getContract(proxyName);
  const oldImplAddr = await proxy.implementation();

  await deploy(contractName, {
    from: await fixture.strategist.getAddress(),
    args: [
      forOETH ? addresses.mainnet.OETHProxy : addresses.mainnet.OUSDProxy,
      addresses.mainnet.OGV,
      addresses.mainnet.CVX,
      addresses.mainnet.CVXLocker,
    ],
  });

  const newImpl = await ethers.getContract(contractName);
  log(
    `Replacing ${proxyName} implementation at ${oldImplAddr} with the fresh bytecode`
  );
  await replaceContractAt(oldImplAddr, newImpl);
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
    fixtureStrategyVarName,
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

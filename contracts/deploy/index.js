const { KEY_PROXY_ADMIN, KEY_VAULT } = require("../utils/constants");

const num = 6200 * Math.pow(10, 18);
const infiniteApprovalHex = "0x" + num.toString(16);

const getAssetAddresses = async (deployments) => {
  return [
    (await deployments.get("MockUSDT")).address,
    (await deployments.get("MockUSDC")).address,
    (await deployments.get("MockTUSD")).address,
    (await deployments.get("MockDAI")).address,
  ];
};

const deployCore = async ({ getNamedAccounts, deployments }) => {
  const { deploy } = deployments;
  const {
    deployerAddr,
    governorAddr,
    proxyAdminAddr,
  } = await getNamedAccounts();

  const governorSigner = (await ethers.getSigners()).find(
    (x) => x._address === governorAddr
  );
  const deployerSigner = (await ethers.getSigners()).find(
    (x) => x._address === deployerAddr
  );

  /*
  const mockUsdtContract = await ethers.getContractAt(
    mockUsdt.abi,
    mockUsdt.address,
    deployerSigner
  );
  mockUsdtContract.mint(
    utils.parseUnits("10000.0", await mockUsdtContract.decimals())
  );
  // Send some Mock USDT to the governor account
  mockUsdtContract.transfer(
    governorAddr,
    utils.parseUnits("5000.0", await mockUsdtContract.decimals())
  );
  */

  const kernel = await deploy("Kernel", {
    from: governorAddr,
    args: [],
  });

  const oUsd = await deploy("OUSD", {
    from: governorAddr,
    args: [kernel.address],
  });

  const vault = await deploy("Vault", {
    from: governorAddr,
  });

  // Initialize Kernel
  const kernelContract = await ethers.getContractAt(
    kernel.abi,
    kernel.address,
    governorSigner
  );
  const moduleKeys = [KEY_PROXY_ADMIN, KEY_VAULT];
  const moduleAddresses = [proxyAdminAddr, vault.address];
  await kernelContract.initialize(moduleKeys, moduleAddresses, governorAddr);

  const vaultContract = await ethers.getContractAt(vault.abi, vault.address);

  await vaultContract.initialize(
    await getAssetAddresses(deployments),
    kernelContract.address,
    oUsd.address
  );

  /*
  mockUsdtContract.approve(vaultContract.address, infiniteApprovalHex);
  mockUsdtContract
    .connect(governorSigner)
    .approve(vaultContract.address, infiniteApprovalHex);

  */
};

deployCore.dependencies = ["mocks"];

module.exports = deployCore;

const { KEY_PROXY_ADMIN, KEY_VAULT } = require("../utils/constants");
const { utils } = require("ethers");

const num = 6200 * Math.pow(10, 18);
const infiniteApprovalHex = "0x" + num.toString(16);

module.exports = async ({ getNamedAccounts, deployments }) => {
  const { deploy } = deployments;
  const {
    deployerAddr,
    governorAddr,
    proxyAdminAddr,
  } = await getNamedAccounts();

  const mockUsdt = await deploy("MockUSDT", {
    from: deployerAddr,
    args: [],
  });

  const governorSigner = (await ethers.getSigners()).find(
    (x) => x._address === governorAddr
  );
  const deployerSigner = (await ethers.getSigners()).find(
    (x) => x._address === deployerAddr
  );

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

  const mockTusd = await deploy("MockTUSD", {
    from: deployerAddr,
    args: [],
  });

  const mockUsdc = await deploy("MockUSDC", {
    from: deployerAddr,
    args: [],
  });

  const mockDai = await deploy("MockDAI", {
    from: deployerAddr,
    args: [],
  });

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
    args: [oUsd.address],
  });

  const vaultContract = await ethers.getContractAt(vault.abi, vault.address);

  await vaultContract.createMarket(mockUsdt.address);
  await vaultContract.createMarket(mockTusd.address);
  await vaultContract.createMarket(mockUsdc.address);
  await vaultContract.createMarket(mockDai.address);

  const kernelContract = await ethers.getContractAt(
    kernel.abi,
    kernel.address,
    governorSigner
  );
  const moduleKeys = [KEY_PROXY_ADMIN, KEY_VAULT];
  const moduleAddresses = [proxyAdminAddr, vault.address];
  await kernelContract.initialize(moduleKeys, moduleAddresses, governorAddr);

  mockUsdtContract.approve(vaultContract.address, infiniteApprovalHex);
  mockUsdtContract
    .connect(governorSigner)
    .approve(vaultContract.address, infiniteApprovalHex);
};

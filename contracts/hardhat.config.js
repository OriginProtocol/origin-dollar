const ethers = require("ethers");
const { utils } = require("ethers");

// USDT has its own ABI because of non standard returns
const usdtAbi = require("./test/abi/usdt.json").abi;
const daiAbi = require("./test/abi/erc20.json");
const tusdAbi = require("./test/abi/erc20.json");
const usdcAbi = require("./test/abi/erc20.json");

require("@nomiclabs/hardhat-waffle");
require("@nomiclabs/hardhat-solhint");
require("hardhat-deploy");
require("hardhat-contract-sizer");
require("hardhat-deploy-ethers");

const MAINNET_DEPLOYER = "0xAed9fDc9681D61edB5F8B8E421f5cEe8D7F4B04f";
const MAINNET_MULTISIG = "0x52BEBd3d7f37EC4284853Fd5861Ae71253A7F428";

const mnemonic =
  "replace hover unaware super where filter stone fine garlic address matrix basic";

let privateKeys = [];

let derivePath = "m/44'/60'/0'/0/";
for (let i = 0; i <= 10; i++) {
  const wallet = new ethers.Wallet.fromMnemonic(mnemonic, `${derivePath}${i}`);
  privateKeys.push(wallet.privateKey);
}

task(
  "mainnet_env_vars",
  "Check env vars are properly set for a Mainnet deployment",
  async () => {
    const envVars = ["PROVIDER_URL", "DEPLOYER_PK", "GOVERNOR_PK"];
    for (const envVar of envVars) {
      if (!process.env[envVar]) {
        throw new Error(
          `For Mainnet deploy env var ${envVar} must be defined.`
        );
      }
    }

    if (process.env.GAS_MULTIPLIER) {
      const value = Number(process.env.GAS_MULTIPLIER);
      if (value < 0 || value > 2) {
        throw new Error(`Check GAS_MULTIPLIER. Value out of range.`);
      }
    }
    console.log("All good. Deploy away!");
  }
);

task("accounts", "Prints the list of accounts", async (taskArguments, hre) => {
  const accounts = await hre.ethers.getSigners();
  const roles = ["Deployer", "Governor"];

  const isMainnetOrRinkeby = ["mainnet", "rinkeby"].includes(hre.network.name);
  if (isMainnetOrRinkeby) {
    privateKeys = [process.env.DEPLOYER_PK, process.env.GOVERNOR_PK];
  }

  let i = 0;
  for (const account of accounts) {
    const role = roles.length > i ? `[${roles[i]}]` : "";
    const address = await account.getAddress();
    console.log(address, privateKeys[i], role);
    if (!address) {
      throw new Error(`No address defined for role ${role}`);
    }
    i++;
  }
});

task("fund", "Fund accounts on mainnet fork", async (taskArguments, hre) => {
  const addresses = require("./utils/addresses");
  const {
    usdtUnits,
    daiUnits,
    usdcUnits,
    tusdUnits,
    isFork,
  } = require("./test/helpers");

  let usdt, dai, tusd, usdc, nonStandardToken;
  if (isFork) {
    usdt = await hre.ethers.getContractAt(usdtAbi, addresses.mainnet.USDT);
    dai = await hre.ethers.getContractAt(daiAbi, addresses.mainnet.DAI);
    tusd = await hre.ethers.getContractAt(tusdAbi, addresses.mainnet.TUSD);
    usdc = await hre.ethers.getContractAt(usdcAbi, addresses.mainnet.USDC);
  } else {
    usdt = await hre.ethers.getContract("MockUSDT");
    dai = await hre.ethers.getContract("MockDAI");
    tusd = await hre.ethers.getContract("MockTUSD");
    usdc = await hre.ethers.getContract("MockUSDC");
    nonStandardToken = await hre.ethers.getContract("MockNonStandardToken");
  }

  let binanceSigner;
  const signers = await hre.ethers.getSigners();
  const { governorAddr } = await getNamedAccounts();

  if (isFork) {
    await hre.network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [addresses.mainnet.Binance],
    });
    binanceSigner = await hre.ethers.provider.getSigner(
      addresses.mainnet.Binance
    );
    // Send some Ethereum to Governor
    await binanceSigner.sendTransaction({
      to: governorAddr,
      value: utils.parseEther("100"),
    });
  }

  for (let i = 0; i < 10; i++) {
    if (isFork) {
      await dai
        .connect(binanceSigner)
        .transfer(await signers[i].getAddress(), daiUnits("1000"));
      await usdc
        .connect(binanceSigner)
        .transfer(await signers[i].getAddress(), usdcUnits("1000"));
      await usdt
        .connect(binanceSigner)
        .transfer(await signers[i].getAddress(), usdtUnits("1000"));
      await tusd
        .connect(binanceSigner)
        .transfer(await signers[i].getAddress(), tusdUnits("1000"));
    } else {
      await dai.connect(signers[i]).mint(daiUnits("1000"));
      await usdc.connect(signers[i]).mint(usdcUnits("1000"));
      await usdt.connect(signers[i]).mint(usdtUnits("1000"));
      await tusd.connect(signers[i]).mint(tusdUnits("1000"));
      await nonStandardToken.connect(signers[i]).mint(usdtUnits("1000"));
    }
  }
});

module.exports = {
  solidity: {
    version: "0.5.11",
    settings: {
      optimizer: {
        enabled: true,
      },
    },
  },
  networks: {
    hardhat: {
      mnemonic,
    },
    rinkeby: {
      url: `${process.env.PROVIDER_URL}`,
      accounts: [
        process.env.DEPLOYER_PK || privateKeys[1],
        process.env.GOVERNOR_PK || privateKeys[1],
      ],
      gasMultiplier: process.env.GAS_MULTIPLIER || 1,
    },
    mainnet: {
      url: `${process.env.PROVIDER_URL}`,
      accounts: [
        process.env.DEPLOYER_PK || privateKeys[0],
        process.env.GOVERNOR_PK || privateKeys[0],
      ],
      gasMultiplier: process.env.GAS_MULTIPLIER || 1,
    },
  },
  mocha: {
    bail: process.env.BAIL === "true",
  },
  throwOnTransactionFailures: true,
  namedAccounts: {
    deployerAddr: {
      default: 0,
      mainnet: MAINNET_DEPLOYER,
      hardhat: 0,
    },
    governorAddr: {
      default: 1,
      mainnet: MAINNET_MULTISIG,
      hardhat: process.env.FORK === "true" ? MAINNET_MULTISIG : 1,
    },
  },
  gasReporter: {
    currency: "USD",
    // outputFile: 'gasreport.out',
    enabled: Boolean(process.env.GAS_REPORT),
  },
  contractSizer: {
    alphaSort: true,
    runOnCompile: true,
  },
  etherscan: {
    apiKey: process.env.ETHERSCAN_API_KEY,
  },
};

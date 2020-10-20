const { utils } = require("ethers");

const BigNumber = require("bignumber.js");
BigNumber.set({ EXPONENTIAL_AT: [-70, 200] });
const UniswapStrategy = artifacts.require("UniswapStrategy");
const Vault = artifacts.require("Vault");
const {
  abi: erc20_abi,
} = require("@openzeppelin/contracts/build/contracts/ERC20");

const { abi: pair_abi } = require("@uniswap/v2-core/build/IUniswapV2Pair");

const Binance = "0x3f5CE5FBFe3E9af3971dD833D26bA9b5C936f0bE";

const usdc_addr = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
const dai_addr = "0x6B175474E89094C44Da98b954EedeAC495271d0F";
const usdt_addr = `0xdAC17F958D2ee523a2206206994597C13D831ec7`;

const stablecoins = [usdc_addr, dai_addr, usdt_addr];

const vault_addr = `0xf251Cb9129fdb7e9Ca5cad097dE3eA70caB9d8F9`;
// const mainnet_vault = await Vault.at(vault_addr);

const usdc = new web3.eth.Contract(erc20_abi, usdc_addr);
const usdt = new web3.eth.Contract(erc20_abi, usdt_addr);
const dai = new web3.eth.Contract(erc20_abi, dai_addr);

const dai_usdt = `0xb20bd5d04be54f870d5c0d3ca85d82b34b836405`;
const usdc_usdt = `0x3041cbd36888becc7bbcbc0045e3b1f144466f5f`;
const dai_usdc = `0xae461ca67b15dc8dc81ce7615e0320da1a9ab8d5`;

const PAIRS = [
  Object.values({
    pair: dai_usdt,
    last_deposited_amount_token0: 0,
    last_deposited_amount_token1: 0,
    when_deposited: 0,
  }),
  Object.values({
    pair: usdc_usdt,
    last_deposited_amount_token0: 0,
    last_deposited_amount_token1: 0,
    when_deposited: 0,
  }),
  Object.values({
    pair: dai_usdc,
    last_deposited_amount_token0: 0,
    last_deposited_amount_token1: 0,
    when_deposited: 0,
  }),
];

contract("UniswapStrategy", (accounts) => {
  const [main_account, someone_else] = accounts;

  const fund_contract = async (addr) => {
    return Promise.all([
      usdc.methods.transfer(addr, `${1000e6}`).send({ from: Binance }),
      usdt.methods.transfer(addr, `${1000e6}`).send({ from: Binance }),
      dai.methods
        .transfer(addr, new BigNumber(`${1000e18}`).toString())
        .send({ from: Binance }),
    ]);
  };

  it("initializes with pairs", async () => {
    const instance = await UniswapStrategy.new();
    await instance.initialize(PAIRS, stablecoins);
  });

  it("initializes and funds the contract, depositing liquidity", async () => {
    const instance = await UniswapStrategy.new();
    await instance.initialize(PAIRS, stablecoins);
    await fund_contract(instance.address);
    // 1%
    await instance.deposit(usdc_usdt, `10`);
  });

  it("initializes, funds, and runs vault depositing ", async () => {
    const vault_instance = await Vault.new();
    const uniswap_instance = await UniswapStrategy.new();
    await uniswap_instance.initialize(PAIRS, stablecoins);
    await fund_contract(vault_instance.address);
    await vault_instance.addStrategy(
      uniswap_instance.address,
      utils.parseUnits("1", 18)
    );
  });
});

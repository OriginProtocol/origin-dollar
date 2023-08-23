const hre = require("hardhat");
const { ethers } = hre;
const { formatUnits } = require("ethers/lib/utils");
const { units } = require("./helpers");

// made up account
//const FUNDING_ACCOUNT = "0x7Aed98F03cAb4bf774cC8E8AccE709F9e10D3EC9";
const RETH_WHALE = "0xc6424e862f1462281b0a5fac078e4b63006bdebf";

const addFundingFunctionsToFixture = async (_fixture) => {
  const {
    impersonateAndFundContract,
    reth
  } = _fixture;

  // call using fundRETH(account, amount)
  _fixture.fundRETH = fundRETH(_fixture, reth, RETH_WHALE);

  return _fixture;
};

const fundERC20 = async (_fixture, erc20Token, whale) => {
  return async (account, amount) => {
    const {
      impersonateAndFundContract
    } = _fixture;

    const decimals = erc20Token.decimals();

    const accountSigner = await impersonateAndFundContract(account);
    await erc20Token
      .connect(accountSigner)
      .transfer(account, await units(amount, erc20Token));
  };
}
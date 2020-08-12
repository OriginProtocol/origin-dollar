const { parseUnits } = require("ethers").utils;
const { deployments } = require("@nomiclabs/buidler");

const THOUSAND_DOLLARS = parseUnits("1000.0", 18);
const HUNDRED_DOLLARS = parseUnits("100.0", 18);

async function defaultFixture (){
    await deployments.fixture();
    const ousd = await ethers.getContract("OUSD");
    const vault = await ethers.getContract("Vault");
    const usdt = await ethers.getContract("MockUSDT"); 
    const dai = await ethers.getContract("MockDAI"); 
    
    const signers = await ethers.getSigners();
    const matt = signers[4]
    const josh = signers[5]
    const anna = signers[6]
    const users = [matt, josh, anna]

    // Give everyone USDT and DAI
    for(const user of users){
      usdt.connect(user).mint(THOUSAND_DOLLARS)
      dai.connect(user).mint(THOUSAND_DOLLARS)
    }

    // Matt and Josh each have $100 OUSD
    for(const user of [matt, josh]){
        // Approve 100 USDT transfer
        await usdt
        .connect(user)
        .approve(vault.address, HUNDRED_DOLLARS);
        // Mint 100 OGN from 100 USDT
        await vault
        .connect(user)
        .depositAndMint(usdt.address, HUNDRED_DOLLARS);
      }

    return {
      matt, josh, anna,
      ousd, 
      vault,
      usdt,
      dai
    }
  }

  function ousdUnits(amount) {
    return parseUnits(amount, 18);
  }

  async function expectBalance(contract, user, expected, message) {
    expect(await contract.balanceOf(user.getAddress()), message).to.equal(
      expected
    );
  }

  module.exports = {
    ousdUnits,
    defaultFixture
  }
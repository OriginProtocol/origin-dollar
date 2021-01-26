const { fund, mint } = require('../../../tasks/account');
const { usdtUnits } = require('../../../test/helpers');
const addresses = require('../../../utils/addresses');
const erc20Abi = require('../../../test/abi/erc20.json');

let utils, usdt, ousd, vault, signer

async function fundAccount4(hre) {
	await fund({
		num: 1,
		amount: '2000'
	}, hre)
}

const getUsdtBalance = async () => {
	return await usdt.connect(signer).balanceOf(signer.address)
}

const getOusdBalance = async () => {
	return await ousd.connect(signer).balanceOf(signer.address)
}

async function setup(hre) {
	utils = hre.ethers.utils
	ousd = await hre.ethers.getContractAt("OUSD", addresses.mainnet.OUSDProxy);
	usdt = await hre.ethers.getContractAt(erc20Abi, addresses.mainnet.USDT);
	const vaultProxy = await hre.ethers.getContract("VaultProxy");
  vault = await ethers.getContractAt("IVault", vaultProxy.address);
	signer = (await hre.ethers.getSigners())[4];

	await fundAccount4(hre)
}

async function beforeDeploy(hre) {
	// fund stablecoins to the 4th account in signers
	await setup(hre)
	
	const usdtBeforeMint = await getUsdtBalance()
	const ousdBeforeMint = await getOusdBalance()
	const usdtToMint = '1000'
	await mint({
		num: 1,
		amount: usdtToMint
	}, hre)

	const usdtAfterMint = await getUsdtBalance()
	const ousdAfterMint = await getOusdBalance()

	const expectedUsdt = usdtBeforeMint.sub(usdtUnits(usdtToMint))
	if (!usdtAfterMint.eq(expectedUsdt)) {
		throw new Error(`Incorrect usdt value. Got ${usdtAfterMint.toString()} expected: ${expectedUsdt.toString()}`);
	}

	return {
		ousdBeforeMint,
		ousdAfterMint
	}
}

async function afterDeploy(hre, beforeDeployData) {
	const ousdBeforeMint = await getOusdBalance()
	await mint({
		num: 1,
		amount: '500'
	}, hre)

	const ousdAfterMint = await getOusdBalance()

	if (!beforeDeployData.ousdAfterMint.eq(ousdBeforeMint)) {
		throw new Error(`Deploy changed the amount of ousd in user's account from ${utils.formatUnits(beforeDeployData.ousdAfterMint, 18)} to ${utils.formatUnits(ousdBeforeMint, 18)}`)
	}

	const ousdToRedeem = utils.parseUnits('800', 18)
	await vault.connect(signer).redeem(ousdToRedeem, utils.parseUnits('770', 18));

	const ousdAfterRedeem = await getOusdBalance()
	const expectedOusd = ousdAfterMint.add(ousdToRedeem)
	if (!expectedOusd.eq(ousdAfterRedeem)) {
		throw new Error(`Incorrect OUSD amount after redeem. Expected: ${expectedOusd.toString()} got: ${ousdAfterRedeem.toString()}`)
	}

	/* TODO: 
	 * - check that ousdAfterMint is withing the allowed tolerance (1%-2%)
	 * - check that stablecoin balance is withing allowed tolerance after redeem
	 * - check that OUSD transfer works
	 */

}


module.exports = {
	beforeDeploy,
	afterDeploy
}
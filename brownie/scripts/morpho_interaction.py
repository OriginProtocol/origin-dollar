from metastrategy import *
# configuration
morphoStrat = "0xC83Cb4F34874E0Ef4c58b4e77D4935F8F819d203";
# end configuration

morphoLens = interface.morpho_lens("0x930f1b46e1d081ec1524efd95752be3ece51ef67")
morphoComp = interface.morpho("0x8888882f8f843896699869179fB6E4f7e3B58888")
comptroller = Contract.from_explorer(morphoLens.comptroller())
oracle = Contract.from_explorer(comptroller.oracle())
CDAI = "0x39aa39c021dfbae8fac545936693ac917d5e7563"
CUSDC = "0x39aa39c021dfbae8fac545936693ac917d5e7563"

morpho_strat = load_contract('morpho_strat', morphoStrat)
vault_admin.setAssetDefaultStrategy(usdc.address, morphoStrat, {'from': GOVERNOR})
#vault_admin.setAssetDefaultStrategy(usdt.address, morphoStrat, {'from': GOVERNOR})
vault_admin.setAssetDefaultStrategy(dai.address, morphoStrat, {'from': GOVERNOR})


with TemporaryFork():
	mint(110000, usdc)
	vault_core.allocate({'from': GOVERNOR})
	chain.mine(3000, chain.time() + 3600 * 24 * 100)

	# cUSDC
	morphoLens.getUserUnclaimedRewards([CDAI], morphoStrat, {'from': me})
	print(morphoLens.getCurrentSupplyBalanceInOf(CDAI, morphoStrat, {'from': me}))
	oracle.getUnderlyingPrice(CDAI)

with TemporaryFork():
	# 273k gas used only cUSDC
	tx = morphoComp.claimRewards([CDAI],False, {"from":morphoStrat});

with TemporaryFork():
	# test mint and withdrawal
	tx = mint(110000, usdc)
	show_transfers(tx)
	print(morpho_strat.checkBalance(usdc.address) / 1e6)
	print(morphoLens.getCurrentSupplyBalanceInOf(CUSDC, morphoStrat, {'from': me}))
	tx = morpho_strat.withdraw(me, usdc, 110000*1e6, {"from": VAULT_PROXY_ADDRESS})
	show_transfers(tx)

with TemporaryFork():
	# test mint and withdrawal
	mint(110000, dai)
	print(morpho_strat.checkBalance(dai.address)/ 1e18)
	print(morphoLens.getCurrentSupplyBalanceInOf(CDAI, morphoStrat, {'from': me}))
	morpho_strat.withdraw(me, dai, 110000*1e6, {"from": VAULT_PROXY_ADDRESS})

with TemporaryFork():
	# 362k gas used claiming cUSDC, CUSDT
	tx = morphoComp.claimRewards([CDAI, "0xf650c3d88d12db855b8bf7d11be6c55a4e07dcc9"],False, {"from":morphoStrat});

with TemporaryFork():
	# 486k gas used claiming cUSDC, CUSDT, CDAI
	tx = morphoComp.claimRewards([CDAI, "0xf650c3d88d12db855b8bf7d11be6c55a4e07dcc9", "0x5d3a536e4d6dbd6114cc1ead35777bab948e3643"],False, {"from":morphoStrat});

with TemporaryFork():
  # 760k gas used. No optimization, claiming rewards for all 3 cTokens
  # 941k gas used. When doing 3 calls for getUserUnclaimedRewards. So 60k per call
	harvestTx = harvester.harvestAndSwap(morphoStrat, { "from":me })
	show_transfers(harvestTx)
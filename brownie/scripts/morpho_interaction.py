from metastrategy import *
# configuration
morphoStrat = "0xC83Cb4F34874E0Ef4c58b4e77D4935F8F819d203";
# end configuration

morphoLens = interface.morpho_lens("0x930f1b46e1d081ec1524efd95752be3ece51ef67")
morphoComp = interface.morpho("0x8888882f8f843896699869179fB6E4f7e3B58888")

vault_admin.setAssetDefaultStrategy(usdc.address, morphoStrat, {'from': GOVERNOR})
vault_admin.setAssetDefaultStrategy(usdt.address, morphoStrat, {'from': GOVERNOR})
mint(110000, usdc)
vault_core.allocate({'from': GOVERNOR})
chain.mine(3000, chain.time() + 3600 * 24 * 100)

# cUSDC
morphoLens.getUserUnclaimedRewards(["0x39aa39c021dfbae8fac545936693ac917d5e7563"], morphoStrat, {'from': me})

with TemporaryFork():
	# 273k gas used only cUSDC
	tx = morphoComp.claimRewards(["0x39aa39c021dfbae8fac545936693ac917d5e7563"],False, {"from":morphoStrat});

with TemporaryFork():
	# 362k gas used claiming cUSDC, CUSDT
	tx = morphoComp.claimRewards(["0x39aa39c021dfbae8fac545936693ac917d5e7563", "0xf650c3d88d12db855b8bf7d11be6c55a4e07dcc9"],False, {"from":morphoStrat});

with TemporaryFork():
	# 486k gas used claiming cUSDC, CUSDT, CDAI
	tx = morphoComp.claimRewards(["0x39aa39c021dfbae8fac545936693ac917d5e7563", "0xf650c3d88d12db855b8bf7d11be6c55a4e07dcc9", "0x5d3a536e4d6dbd6114cc1ead35777bab948e3643"],False, {"from":morphoStrat});

with TemporaryFork():
  # 760k gas used. No optimization, claiming rewards for all 3 cTokens
  # 941k gas used. When doing 3 calls for getUserUnclaimedRewards. So 60k per call
	harvestTx = harvester.harvestAndSwap(morphoStrat, { "from":me })
	show_transfers(harvestTx)
from world import *

STD = {"from": vault_oeth_admin}
# pool factory
#https://etherscan.io/address/0xfADa0f4547AB2de89D1304A668C39B3E09Aa7c76#code

# wstETH / WETH
pool_id = "0x32296969ef14eb0c6d29669c550d4a0449130230000200000000000000000080"
ba_vault=Contract.from_explorer("0xBA12222222228d8Ba445958a75a0704d566BF2C8")
ba_batch_relayer = Contract.from_explorer("0xf77018c0d817dA22caDbDf504C00c0d32cE1e5C2")
wstETHPool = Contract.from_explorer("0x32296969ef14eb0c6d29669c550d4a0449130230")

#approve steth to wrap into wstETH
steth.approve(wsteth.address, 10**50, STD)
wsteth.wrap(10 * 10**18, STD)

weth.approve(ba_vault, 10**36, STD)
wsteth.approve(ba_vault, 10**36, STD)
ba_vault.joinPool(
	pool_id,
	vault_oeth_admin.address, #sender
	vault_oeth_admin.address, #recipient
	[
		[wsteth.address, weth.address], # assets
		[10**18, 10**18], # min amounts in
		'0x', # userData
		False, #fromInternalBalance
	],
	STD
)
# bpt = "0x5aEe1e99fE86960377DE9f88689616916D5DcaBe"
# reth.approve(ba_vault, 10**50, {"from": vault_oeth_core})

# # 1 stands for EXACT_TOKENS_IN_FOR_BPT_OUT
# join_request = ([bpt, wsteth, sfrxeth, reth], [0, 0, 0, 10**18], 1 , False)
# ba_vault.joinPool(pool_id, vault_oeth_core, vault_oeth_core, join_request, {"from": vault_oeth_core})

# # do the same steps as in the SDK and join the pool
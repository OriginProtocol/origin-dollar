from world import *

# pool factory
#https://etherscan.io/address/0xfADa0f4547AB2de89D1304A668C39B3E09Aa7c76#code

pool_id = "0x5aee1e99fe86960377de9f88689616916d5dcabe000000000000000000000467"
ba_vault=Contract.from_explorer("0xBA12222222228d8Ba445958a75a0704d566BF2C8")
ba_batch_relayer = Contract.from_explorer("0xf77018c0d817dA22caDbDf504C00c0d32cE1e5C2")

bpt = "0x5aEe1e99fE86960377DE9f88689616916D5DcaBe"
reth.approve(ba_vault, 10**50, {"from": vault_oeth_core})

# 1 stands for EXACT_TOKENS_IN_FOR_BPT_OUT
join_request = ([bpt, wsteth, sfrxeth, reth], [0, 0, 0, 10**18], 1 , False)
ba_vault.joinPool(pool_id, vault_oeth_core, vault_oeth_core, join_request, {"from": vault_oeth_core})

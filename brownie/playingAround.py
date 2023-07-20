from world import *

#STD = {"from": vault_oeth_admin, "gas_price": 100}
STD = {"from": vault_oeth_admin}
# pool factory
#https://etherscan.io/address/0xfADa0f4547AB2de89D1304A668C39B3E09Aa7c76#code

#eth_whale = "0x00000000219ab540356cbb839cbe05303d7705fa"
#whale = accounts.at(eth_whale, force=True)


# export enum WeightedPoolJoinKind {
#   INIT = 0,
#   EXACT_TOKENS_IN_FOR_BPT_OUT, #User sends precise quantities of tokens, and receives an estimated but unknown (computed at run time) quantity of BPT.
#   TOKEN_IN_FOR_EXACT_BPT_OUT, #User sends an estimated but unknown (computed at run time) quantity of a single token, and receives a precise quantity of BPT.
#   ALL_TOKENS_IN_FOR_EXACT_BPT_OUT, # User sends estimated but unknown (computed at run time) quantities of tokens, and receives precise quantity of BPT
#   ADD_TOKEN,
# }

# export enum ExitKind {
#     EXACT_BPT_IN_FOR_ONE_TOKEN_OUT, #([EXACT_BPT_IN_FOR_ONE_TOKEN_OUT, bptAmountIn, exitTokenIndex]) User sends a precise quantity of BPT, and receives an estimated but unknown (computed at run time) quantity of a single token
#     EXACT_BPT_IN_FOR_TOKENS_OUT, #User sends a precise quantity of BPT, and receives an estimated but unknown (computed at run time) quantities of all tokens
#     BPT_IN_FOR_EXACT_TOKENS_OUT, # User sends an estimated but unknown (computed at run time) quantity of BPT, and receives precise quantities of specified tokens
#     MANAGEMENT_FEE_TOKENS_OUT // for InvestmentPool
# }

#addresses.mainnet.aureDepositor = "0x59d66c58e83a26d6a0e35114323f65c3945c89c1";

# wstETH / WETH
pool_id = "0x32296969ef14eb0c6d29669c550d4a0449130230000200000000000000000080"
ba_vault=Contract.from_explorer("0xBA12222222228d8Ba445958a75a0704d566BF2C8")
ba_batch_relayer = Contract.from_explorer("0xf77018c0d817dA22caDbDf504C00c0d32cE1e5C2")
wstETHPool = Contract.from_explorer("0x32296969ef14eb0c6d29669c550d4a0449130230")
#used just to encode user data. Address is not important since it will never be called
balancerUserDataEncoder = load_contract('balancerUserData', vault_oeth_admin.address)
# get it via coordinator: https://etherscan.io/address/0xaA54f3b282805822419265208e669d12372a3811
booster = load_contract('balancer_booster', "0xA57b8d98dAE62B26Ec3bcC4a365338157060B234")

# DEPOSIT INTO META STABLE POOL

#rewards contract & depositor
rewardPool = Contract.from_explorer("0x59d66c58e83a26d6a0e35114323f65c3945c89c1")

#approve steth to wrap into wstETH
steth.approve(wsteth.address, 10**50, STD)
wsteth.wrap(10 * 10**18, STD)

weth.approve(ba_vault, 10**36, STD)
wsteth.approve(ba_vault, 10**36, STD)

with TemporaryFork():
	# Enter the pool
	ba_vault.joinPool(
		pool_id,
		vault_oeth_admin.address, #sender
		vault_oeth_admin.address, #recipient
		[
			# tokens need to be sorted numerically
			[wsteth.address, weth.address], # assets
			# indexes match above assets
			[0, 36523558823496626525], # min amounts in
			 # balancerUserDataEncoder.userDataTokenInExactBPTOut.encode_input(2, 36158323235261660260, 1)[10:]
			 # balancerUserDataEncoder.userDataTokenInExactBPTOut.encode_input(2, 123, 1)[10:]
			balancerUserDataEncoder.userDataTokenInExactBPTOut.encode_input(2, 36158323235261660260 * 0.97, 1)[10:],
			False, #fromInternalBalance
		],
		STD
	)
	bpt_balance = wstETHPool.balanceOf(vault_oeth_admin)
	print("BPT BALANCE: ", bpt_balance)

	wstETHPool.approve(rewardPool.address, 1e50, STD)
	rewardPool.deposit(bpt_balance, oeth_vault_admin, STD)

	aura_balance = rewardPool.balanceOf(vault_oeth_admin.address, STD)
	print("BPT BALANCE AURA: ", aura_balance)

	# WITHDRAW FROM AURA
	rewardPool.withdraw(aura_balance, oeth_vault_admin, oeth_vault_admin, STD)

	bpt_balance = wstETHPool.balanceOf(vault_oeth_admin)
	print("BPT BALANCE AFTER AURA: ", bpt_balance)


# Exit the pool
ba_vault.exitPool(
	pool_id,
	vault_oeth_admin.address, #sender
	vault_oeth_admin.address, #recipient
	[
		# tokens need to be sorted numerically
		# we should account for some slippage here since it comes down to balance amounts in the pool
		[wsteth.address, weth.address], # assets
		[1*10**18, 0], # min amounts out
		 # userData = balancerUserDataEncoder.userDataTokenInExactBPTOut.encode_input(0, bpt_balance, 0)
		'0x00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000008ac7230489e800000000000000000000000000000000000000000000000000000000000000000000', # userData
		False, #fromInternalBalance
	],
	STD
)

wstETHPool.approve(rewardPool, 1e50, STD)
# DEPLOY TO AURA
rewardPool.deposit(bpt_balance, oeth_vault_admin, STD)
# WITHDRAW FROM AURA
rewardPool.withdraw(10000000000000000000, oeth_vault_admin, oeth_vault_admin, STD)
# END OF DEPOSIT INTO META STABLE POOL



# DEPOSIT INTO COMPOSABLE POOL



# END DEPOSIT INTO COMPOSABLE POOL

from world import *

def expect_approximate(woeth_holder, expected_balance):
	balance = woeth.balanceOf(woeth_holder)
	diff = abs(expected_balance - balance)
	if (diff != 0):
		raise Exception("Unexpected balance for account: %s".format(woeth_holder))

def confirm_balances_after_upgrade():
	expect_approximate("0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb", 1013453939109688661944)
	expect_approximate("0xC460B0b6c9b578A4Cb93F99A691e16dB96Ee5833", 575896531839923556165)
	expect_approximate("0xdca0a2341ed5438e06b9982243808a76b9add6d0", 319671606657733042618)
	expect_approximate("0x8a9d46d28003673cd4fe7a56ecfcfa2be6372e64", 182355401624955452064)
	expect_approximate("0xf65ecb5610000100befba41b9f9cf5ca32838078", 97352556026536192865)
	expect_approximate("0x0a26e7ab5c554232314a8d459eff0ede72333f08", 91628532171545105831)


def manipulate_price():
	OETH_WHALE="0xa4C637e0F704745D182e4D38cAb7E7485321d059"
	whl = {'from': OETH_WHALE }

	woeth.convertToAssets(1e18) / 1e18
	oeth.transfer(woeth.address, 10_000 * 1e18, whl)
	woeth.convertToAssets(1e18) / 1e18

	oeth.approve(woeth.address, 1e50, whl)
	woeth.deposit(5_000 * 1e18, OETH_WHALE, whl)
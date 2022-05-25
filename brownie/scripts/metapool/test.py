from metastrategy import *

# tilt pool towards 3CRV, mint 10mio USDT to Metastrat, then withdraw and redeem that amount
with TemporaryFork():
    with SupplyChanges(OPTS):
        tiltMetapoolTo3CRV()
        mint(10e6)
        #withdrawFromMeta(10e6)
        withdrawAllFromMeta()
        #redeem(10e6)
        show_vault_holdings()


# tilt pool towards OUSD, mint 10mio USDT to Metastrat, then withdraw and redeem that amount
with TemporaryFork():
    with SupplyChanges(OPTS):
        tiltMetapoolToOUSD()
        mint(10e6)
        #withdrawFromMeta(10e6)
        withdrawAllFromMeta()
        redeem(10e6)
        show_vault_holdings()

//TODO Test different deposit strategies and what could be dangerous

def withdrawFromComp(amount, asset):
    comp_strat.withdraw(VAULT_PROXY_ADDRESS, asset.address, amount * math.pow(10, asset.decimals()), {'from': VAULT_PROXY_ADDRESS})
    vault_core.rebase(OPTS)

# make COMP default strategy for USDC & USDT, mint 10mio USDC & USDT to Comp, then withdraw and redeem that amount   
with TemporaryFork():
    with SupplyChanges(OPTS):
        asset_default_strategy(comp_strat, usdc)
        #asset_default_strategy(comp_strat, usdt)

        vault_core.mint(usdc.address, 5e6 * 1e6, 0, OPTS)
        #vault_core.mint(usdt.address, 5e6 * 1e6, 0, OPTS)
        withdrawFromComp(5e6, usdc)
        #withdrawFromComp(5e6, usdt)
        redeem(5e6)
        show_vault_holdings()


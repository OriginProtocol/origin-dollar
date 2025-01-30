# -------------------------------------
# Jan 6, 2025 - Withdraw 1k from new OUSD Morpho Gauntlet Strategies
# -------------------------------------
from world import *

def main():
  with TemporaryForkForReallocations() as txs:
    # Before
    txs.append(vault_core.rebase(std))
    txs.append(vault_value_checker.takeSnapshot(std))

    # Remove 1k USDC from Morpho Gauntlet Strategy
    txs.append(
      vault_admin.withdrawFromStrategy(
        MORPHO_GAUNTLET_PRIME_USDC_STRAT, 
        [usdc], 
        [1000 * 10**6],
        {'from': STRATEGIST}
      )
    )

    # Remove 1k USDT from Morpho Gauntlet Strategy
    txs.append(
      vault_admin.withdrawFromStrategy(
        MORPHO_GAUNTLET_PRIME_USDT_STRAT, 
        [usdt], 
        [1000 * 10**6],
        {'from': STRATEGIST}
      )
    )

    # After
    vault_change = vault_core.totalValue() - vault_value_checker.snapshots(STRATEGIST)[0]
    supply_change = ousd.totalSupply() - vault_value_checker.snapshots(STRATEGIST)[1]
    profit = vault_change - supply_change
    txs.append(vault_value_checker.checkDelta(profit, (1 * 10**18), vault_change, (1 * 10**18), std))
    print("-----")
    print("Profit", "{:.6f}".format(profit / 10**18), profit)
    print("OUSD supply change", "{:.6f}".format(supply_change / 10**18), supply_change)
    print("Vault Change", "{:.6f}".format(vault_change / 10**18), vault_change)
    print("-----")

# -------------------------------------
# Jan 7, 2025 - Withdraw 100k USDC from Morpho Steakhouse and deposit in Morpho Gauntlet Prime
# -------------------------------------
from world import *

def main():
  with TemporaryForkForReallocations() as txs:
    # Before
    txs.append(vault_core.rebase(std))
    txs.append(vault_value_checker.takeSnapshot(std))

    # Remove 100k USDC from Morpho Steakhouse Strategy
    txs.append(
      vault_admin.withdrawFromStrategy(
        MORPHO_META_USDC_STRAT, 
        [usdc], 
        [1000000 * 10**6],
        {'from': STRATEGIST}
      )
    )

    # Deposit 100k USDC tin Morpho Gauntlet Prime Strategy
    txs.append(
      vault_admin.depositToStrategy(
        MORPHO_GAUNTLET_PRIME_USDC_STRAT, 
        [usdc],
        [1000000 * 10**6],
        {'from': STRATEGIST}
      )
    )

    # After
    vault_change = vault_core.totalValue() - vault_value_checker.snapshots(STRATEGIST)[0]
    supply_change = ousd.totalSupply() - vault_value_checker.snapshots(STRATEGIST)[1]
    profit = vault_change - supply_change
    txs.append(vault_value_checker.checkDelta(profit, (1 * 10**18), vault_change, (1 * 10**18), std))
    print("-----")
    print("Profit", "{:.6f}".format(profit / 10**18), profit)
    print("OUSD supply change", "{:.6f}".format(supply_change / 10**18), supply_change)
    print("Vault Change", "{:.6f}".format(vault_change / 10**18), vault_change)
    print("-----")


# -------------------------------------
# Jan 29, 2025 - Equalizer Bribes
# -------------------------------------

from eth_abi.packed import encode_packed
from aerodrome_harvest import *
def main():
  with TemporaryForkForReallocations() as txs:
    # Swap WETH to superOETHb
    amount = 0.02933972 * 10**18
    txs.append(weth.approve(AERODROME_SWAP_ROUTER_BASE, amount, {'from': MULTICHAIN_STRATEGIST}))

    oethb_path = encode_packed(
      ['address', 'int24', 'address'],
      [
        WETH_BASE,
        1, # WETH > OETHb tickSpacing
        OETHB,
      ]
    ).hex()

    txs.append(
      aero_router.exactInput(
        swap_params_multiple(
          amount,
          oethb_path,
          recipient=MULTICHAIN_STRATEGIST,
          to_token=OETHB,
          to_token_label="WETH"
        ),
        {'from': MULTICHAIN_STRATEGIST}
      )
    )

    # Bribe spectra/oethb pool
    spectra_pool_bribe_amount = 0.01903247923 * 10**18
    txs.append(
      oethb.approve(EQUALIZER_SPECTRA_OETHB_BRIBE_CONTRACT, spectra_pool_bribe_amount, {'from': MULTICHAIN_STRATEGIST})
    )

    spectra_oethb_bribe_contract = load_contract("aero_bribes", EQUALIZER_SPECTRA_OETHB_BRIBE_CONTRACT)
    txs.append(
      spectra_oethb_bribe_contract.notifyRewardAmount(
        OETHB,
        spectra_pool_bribe_amount,
        {'from': MULTICHAIN_STRATEGIST}
      )
    )

    # Bribe weth/oethb pool
    weth_pool_bribe_amount = 0.004425216108 * 10**18
    txs.append(
      oethb.approve(EQUALIZER_WETH_OETHB_BRIBE_CONTRACT, weth_pool_bribe_amount, {'from': MULTICHAIN_STRATEGIST})
    )

    weth_oethb_bribe_contract = load_contract("aero_bribes", EQUALIZER_WETH_OETHB_BRIBE_CONTRACT)
    txs.append(
      weth_oethb_bribe_contract.notifyRewardAmount(
        OETHB,
        weth_pool_bribe_amount,
        {'from': MULTICHAIN_STRATEGIST}
      )
    )

    print(to_gnosis_json(txs, MULTICHAIN_STRATEGIST, "1"))

# -------------------------------------
# Jan 29, 2025 - Bridge wOETH to Ethereum
# -------------------------------------
from world_base import *
import eth_abi

def main():
  with TemporaryForkForReallocations() as txs:

    eth_chain_selector = 5009297550715157269
    amount = woeth.balanceOf(MULTICHAIN_STRATEGIST)

    # bridge wOETH to Ethereum using CCIP
    txs.append(
      woeth.approve(BASE_CCIP_ROUTER, amount, {'from': MULTICHAIN_STRATEGIST})
    )

    txs.append(
      ccip_router.ccipSend(
        eth_chain_selector,
        [
          eth_abi.encode(['address'], [MULTICHAIN_STRATEGIST]),
          '0x',
          [(BRIDGED_WOETH_BASE, amount)],
          ADDR_ZERO,
          '0x97a657c9000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000'
        ],
        {'from': MULTICHAIN_STRATEGIST, 'value': 0.003 * 10**18}
      )
    )
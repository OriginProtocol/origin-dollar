from world import *

old_buyback = load_contract('buyback', "0x77314EB392b2be47C014cde0706908b3307Ad6a9")
recent_buyback = load_contract('buyback', "0x6C5cdfB47150EFc52072cB93Eea1e0F123529748")
new_buyback = load_contract('buyback', "0xa863A50233FB5Aa5aFb515e6C3e6FB9c075AA594")

def main():
  with TemporaryFork():
    print(
      "Leftover OGN in first Buyback contract:\n\t\t",
      commas(ogn.balanceOf(old_buyback.address))
    )
    print(
      "Leftover OUSD in most recent Buyback contract:\n\t\t",
      commas(ousd.balanceOf(recent_buyback.address))
    )
    
    ousd_balance = ousd.balanceOf(new_buyback.address)
    print("Balance of new Buyback:")
    print("\tOGN: ", commas(ogn.balanceOf(new_buyback.address)))
    print("\tOUSD:", commas(ousd_balance))

    print("\n\ndistributeAndSwap():")
    strategist_bal = ousd.balanceOf(STRATEGIST)
    rewardssource_bal = ogv.balanceOf(REWARDS_SOURCE)
    # Try swapping and redistributing
    new_buyback.distributeAndSwap(
      ousd_balance,
      "1",
      std # Strategist
    )
    print(
      "Strategist OUSD Balance Diff", 
      commas(ousd.balanceOf(STRATEGIST) - strategist_bal)
    )
    print(
      "RewardsSource OGV Balance Diff", 
      commas(ogv.balanceOf(REWARDS_SOURCE) - rewardssource_bal)
    )

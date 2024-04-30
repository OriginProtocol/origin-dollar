from world import *
from types import SimpleNamespace

def main():
  with TemporaryFork():

    calldata = vault_oeth_admin.setRedeemFeeBps.encode_input(0)

    # Check if multisig can create proposals on Timelock
    tx = timelock_contract.schedule(
      OETH_VAULT, # Target
      0, # Value
      calldata,
      "",
      "",
      24 * 60 * 60, # delay
      {'from': GOV_MULTISIG}
    )

    tx.info()

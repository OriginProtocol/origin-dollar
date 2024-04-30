from world import *
from brownie import chain

def main():
  with TemporaryFork():
    calldata = vault_oeth_admin.setRedeemFeeBps.encode_input(0)

    print("Creating a test proposal on Timelock...")
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
    
    print("Waiting until it's ready for execution...")
    # Fast forward to execute
    chain.sleep(24 * 60 * 60 + 10)

    print("Executing...")
    # Test execution
    tx = timelock_contract.execute(
      OETH_VAULT, # Target
      0, # Value
      calldata,
      "",
      "",
      {'from': GOV_MULTISIG}
    )
    tx.info()

    if vault_oeth_admin.redeemFeeBps() != 0:
      raise Exception("Action not updated")

    print("All Good!")
    
  print("-------------------------------------------")
  with TemporaryFork():
    calldata = vault_oeth_admin.setRedeemFeeBps.encode_input(1)

    print("\n\nCreating another test proposal on Timelock...")
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

    action_hash = timelock_contract.hashOperation(
      OETH_VAULT, # Target
      0, # Value
      calldata,
      "",
      ""
    )
    
    print("Cancelling tx...")
    # Make sure the multisig can cancel txs as well
    tx = timelock_contract.cancel(action_hash, {'from': GOV_MULTISIG})
    tx.info()

    if timelock_contract.isOperation(action_hash):
      raise Exception("Failed to cancel op")
    
    print("All Good!")


    

# Fix for approval button state persistence across contract selections
#
# This script demonstrates the approval state management fix where
# approval allowances are properly checked and maintained when
# switching between different contract selections.
#
# Previously, the approval state was reset when users switched
# between contracts, causing unnecessary re-approval prompts.
# This fix ensures the approval state is correctly read from
# on-chain allowance data before prompting for approval.

from brownie import accounts, Contract, web3
from brownie.network.gas.strategies import GasNowStrategy

# Configuration
INFINITE_ALLOWANCE = 2**256 - 1
MIN_ALLOWANCE_THRESHOLD = 0  # Minimum allowance before re-approval is needed


def check_approval_state(token_address, owner_address, spender_address):
    """
    Check the current approval state for a given token, owner, and spender.
    Returns the current allowance amount.

    This function should be called when switching between contract selections
    to maintain the correct approval button state in the UI.
    """
    token = Contract(token_address)
    allowance = token.allowance(owner_address, spender_address)
    return allowance


def needs_approval(token_address, owner_address, spender_address, required_amount):
    """
    Determine if an approval transaction is needed for the given amount.

    Previously, this check was not performed when switching between contracts,
    causing the approval button to always appear active regardless of existing
    on-chain approvals.

    Args:
        token_address: ERC20 token contract address
        owner_address: Token owner's address
        spender_address: Contract address that needs approval to spend tokens
        required_amount: Amount of tokens that need to be approved

    Returns:
        bool: True if approval is needed, False if existing allowance is sufficient
    """
    current_allowance = check_approval_state(
        token_address, owner_address, spender_address
    )
    return current_allowance < required_amount


def get_approval_button_state(token_address, owner_address, spender_address, amount):
    """
    Get the correct approval button state for the UI.

    This is the core fix - when a user switches between contract selections,
    the UI should query this function to determine the correct button state
    rather than defaulting to 'approval needed'.

    Args:
        token_address: ERC20 token contract address
        owner_address: Token owner's address
        spender_address: Currently selected contract address
        amount: Amount the user wants to transact

    Returns:
        dict: Button state information
            - needs_approval (bool): Whether approval button should be shown
            - current_allowance (int): Current on-chain allowance
            - is_sufficient (bool): Whether current allowance covers the amount
    """
    current_allowance = check_approval_state(
        token_address, owner_address, spender_address
    )
    is_sufficient = current_allowance >= amount

    return {
        "needs_approval": not is_sufficient,
        "current_allowance": current_allowance,
        "is_sufficient": is_sufficient,
    }


def demonstrate_approval_state_fix():
    """
    Demonstrate the approval state fix by simulating contract selection switching.

    This script shows how approval states should be maintained when users
    switch between different contract selections in the dapp.
    """
    print("Approval State Fix Demonstration")
    print("=" * 50)
    print()
    print("Scenario: User switches between two vault contracts")
    print("Expected behavior: Approval button state should reflect")
    print("the on-chain allowance for each selected contract.")
    print()
    print("Fix summary:")
    print("  - Before: Approval button state was reset on contract switch")
    print("  - After:  Approval button state is read from on-chain allowance")
    print()
    print("The get_approval_button_state() function should be called")
    print("whenever a user selects a different contract to interact with.")
    print("This ensures the UI accurately reflects whether an approval")
    print("transaction is needed for the selected contract.")
    print()

    # Example of how to use the fix
    print("Usage example:")
    print("  state = get_approval_button_state(")
    print("      token_address=OUSD_ADDRESS,")
    print("      owner_address=user_wallet,")
    print("      spender_address=selected_contract,")
    print("      amount=desired_amount")
    print("  )")
    print("  if state['needs_approval']:")
    print("      show_approval_button()")
    print("  else:")
    print("      show_action_button()")


if __name__ == "__main__":
    demonstrate_approval_state_fix()

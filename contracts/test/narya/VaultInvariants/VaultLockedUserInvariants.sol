pragma solidity ^0.8.19;

import {IERC20} from "lib/forge-std/src/interfaces/IERC20.sol";

abstract contract VaultLockedUserInvariants {
    address _lockedUser;
    address _ERC20tokenAddress;
    uint _userAmount;
    uint _minimumVaultValue;

    // called in setUp
    function setUpVaultLockedUserInvariants() public virtual;

    // This wraps how the _lockedUser redeem its shares
    // The wrap is for a simple low level call in the invariant
    function redeem() public virtual;

    // used to lock funds that should succeed
    function lockFunds() public virtual;
    
    // get the total value in the vault
    function getVaultTotalValue() public virtual returns (uint256);
    
    // Vault Value (X) is not empty as at least one user locked funds
    // Check that the balance doesn't drop below 90% of (X)
    function invariantVaultBalanceNotDrained() public {
        uint256 curValue = getVaultTotalValue();
        require(curValue >= _minimumVaultValue * 9 / 10, 
            "Vault lost more than 90% funds");
    }

    // A user should be able to reclaim its funds from the vault
    function invariantVaultUserLocked() public {
        uint balanceBefore = IERC20(_ERC20tokenAddress).balanceOf(_lockedUser);

        // if funds are locked, user should be able to unlock
        (bool success,) = address(this).call(
            abi.encodeWithSignature("redeem()"));
        
        uint amount = IERC20(_ERC20tokenAddress).balanceOf(_lockedUser) - balanceBefore;

        // should be able to get > 90% even despite the rounding issues in Origin
        require(success && amount >= _userAmount * 9/10, "lost locked funds");

        // reset state for next call
        lockFunds();
    }
}
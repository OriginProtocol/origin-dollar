pragma solidity ^0.8.19;

import {IERC20} from "lib/forge-std/src/interfaces/IERC20.sol";
import {console} from "lib/forge-std/src/console.sol";

abstract contract VaultLockedUserInvariants {
    address _lockedUser;
    address _ERC20tokenAddress;
    address[] _ERC20tokensRedeemed;
    uint _userAmount;
    // used by invariantVaultBalanceNotDrained
    uint _minimumVaultValue;
    // for higher precision
    uint constant shift = 18;

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
        require(_ERC20tokensRedeemed.length > 0, "no redeem token address added");

        uint[] memory balancesBefore = new uint[](_ERC20tokensRedeemed.length);
        for (uint i = 0; i < _ERC20tokensRedeemed.length; ++i) {
            IERC20 _token = IERC20(_ERC20tokensRedeemed[i]);
            balancesBefore[i] = _token.balanceOf(_lockedUser) * (10**(shift-_token.decimals()));
        }

        // attempt to redeem which should always work
        (bool success,) = address(this).call(
            abi.encodeWithSignature("redeem()"));
        
        // now because the assets are pegged to stable or OETH
        // we approximate their values to be kinda equal

        uint _totalAmount = 0;
        for (uint i = 0; i < _ERC20tokensRedeemed.length; ++i) {
            IERC20 _token = IERC20(_ERC20tokensRedeemed[i]);
            uint balanceAfter = _token.balanceOf(_lockedUser) * (10**(shift-_token.decimals()));
            _totalAmount += (balanceAfter - balancesBefore[i]);
        }

        // should be able to get > 90% even despite the rounding issues in Origin
        require(success, "redeem failed");
        uint requestedAmount = _userAmount * (10**(shift-IERC20(_ERC20tokenAddress).decimals()));
        require(_totalAmount >= (requestedAmount * 9) / 10, "redeemed less than 90%");

        // reset state for next call
        lockFunds();
    }
}
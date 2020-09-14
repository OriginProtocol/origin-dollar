pragma solidity 0.5.11;

import "./MintableERC20.sol";

/**
 * Mock token contract to simulate tokens that don't
 * throw/revert when a transfer/transferFrom call fails
 */
contract MockNonStandardToken is MintableERC20 {
    uint256 public constant decimals = 6;
    string public constant symbol = "NonStandardToken";
    string public constant name = "NonStandardToken";

    function transfer(address recipient, uint256 amount) public returns (bool) {
        if (balanceOf(msg.sender) < amount) {
            // Fail silently
            return false;
        }

        _transfer(_msgSender(), recipient, amount);
        return true;
    }

    function transferFrom(
        address sender,
        address recipient,
        uint256 amount
    ) public returns (bool) {
        if (balanceOf(sender) < amount) {
            // Fail silently
            return false;
        }

        _transfer(sender, recipient, amount);
        _approve(
            sender,
            _msgSender(),
            allowance(sender, _msgSender()).sub(
                amount,
                "ERC20: transfer amount exceeds allowance"
            )
        );
        return true;
    }
}

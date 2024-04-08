pragma solidity ^0.8.0;

import { SafeMath } from "@openzeppelin/contracts/utils/math/SafeMath.sol";

import "./MintableERC20.sol";

/**
 * Mock token contract to simulate tokens that don't
 * throw/revert when a transfer/transferFrom call fails
 */
contract MockNonStandardToken is MintableERC20 {
    using SafeMath for uint256;

    constructor() ERC20("NonStandardToken", "NonStandardToken") {}

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    function transfer(address recipient, uint256 amount)
        public
        override
        returns (bool)
    {
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
    ) public override returns (bool) {
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

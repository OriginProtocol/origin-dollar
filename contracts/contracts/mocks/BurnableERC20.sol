pragma solidity ^0.8.0;

import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

interface IBurnableERC20 {
    function burn(uint256 value) external returns (bool);
}

/**
 * @title BurnableERC20
 * @dev Exposes the burn function of ERC20 for tests
 */
contract BurnableERC20 is IBurnableERC20, ERC20 {
    /**
     * @dev Function to burn tokens
     * @param value The amount of tokens to burn.
     * @return A boolean that indicates if the operation was successful.
     */
    function burn(uint256 value) public returns (bool) {
        _burn(msg.sender, value);
        return true;
    }
}

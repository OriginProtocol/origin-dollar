// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.0;

import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

interface IBurnableERC20 {
    function burn(uint256 value) external returns (bool);

    function burnFrom(address account, uint256 value) external returns (bool);
}

/**
 * @title BurnableERC20
 * @dev Exposes the burn function of ERC20 for tests
 */
abstract contract BurnableERC20 is IBurnableERC20, ERC20 {
    /**
     * @dev Function to burn tokens
     * @param value The amount of tokens to burn.
     * @return A boolean that indicates if the operation was successful.
     */
    function burn(uint256 value) public virtual override returns (bool) {
        _burn(msg.sender, value);
        return true;
    }

    /**
     * @dev Function to burn tokens from a specific account
     * @param account The address with the tokens to burn.
     * @param value The amount of tokens to burn.
     * @return A boolean that indicates if the operation was successful.
     */
    function burnFrom(address account, uint256 value)
        public
        override
        returns (bool)
    {
        _burn(account, value);
        return true;
    }
}

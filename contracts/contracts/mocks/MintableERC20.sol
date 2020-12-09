pragma solidity 0.5.11;

import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

interface IMintableERC20 {
    function mint(uint256 value) external returns (bool);
}

/**
 * @title ERC20Mintable
 * @dev ERC20 minting logic
 */
contract MintableERC20 is IMintableERC20, ERC20 {
    /**
     * @dev Function to mint tokens
     * @param value The amount of tokens to mint.
     * @return A boolean that indicates if the operation was successful.
     */
    function mint(uint256 value) public returns (bool) {
        _mint(msg.sender, value);
        return true;
    }

    function burn(uint256 value) public returns (bool) {
        _burn(msg.sender, value);
        return true;
    }
}

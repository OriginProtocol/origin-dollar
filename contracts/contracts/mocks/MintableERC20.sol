// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.0;

import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

interface IMintableERC20 {
    function mint(uint256 value) external;

    function mintTo(address to, uint256 value) external;
}

/**
 * @title MintableERC20
 * @dev Exposes the mint function of ERC20 for tests
 */
abstract contract MintableERC20 is IMintableERC20, ERC20 {
    /**
     * @dev Function to mint tokens
     * @param _value The amount of tokens to mint.
     */
    function mint(uint256 _value) public virtual override {
        _mint(msg.sender, _value);
    }

    /**
     * @dev Function to mint tokens
     * @param _to Address to mint to.
     * @param _value The amount of tokens to mint.
     */
    function mintTo(address _to, uint256 _value) public virtual override {
        _mint(_to, _value);
    }
}

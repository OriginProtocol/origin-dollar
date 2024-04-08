// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract MockVaultForBase {
    address public immutable strategistAddr;
    address public immutable oTokenAddr;

    constructor(address _strategistAddr, address _oTokenAddr) {
        strategistAddr = _strategistAddr;
        oTokenAddr = _oTokenAddr;
    }

    function mintForStrategy(uint256 _amount) external {
        // TODO: Mint some OETH and transfer it to the caller
    }

    function burnForStrategy(uint256 _amount) external {
        // TODO: Burn OETH from the caller address
    }
}

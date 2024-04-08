// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IERC20MintableBurnable {
    function mintTo(address to, uint256 value) external;

    function burnFrom(address account, uint256 value) external;
}

contract MockVaultForBase {
    address public immutable strategistAddr;
    address public immutable oTokenAddr;

    constructor(address _strategistAddr, address _oTokenAddr) {
        strategistAddr = _strategistAddr;
        oTokenAddr = _oTokenAddr;
    }

    function mintForStrategy(uint256 _amount) external {
        IERC20MintableBurnable(oTokenAddr).mintTo(msg.sender, _amount);
    }

    function burnForStrategy(uint256 _amount) external {
        IERC20MintableBurnable(oTokenAddr).burnFrom(msg.sender, _amount);
    }
}

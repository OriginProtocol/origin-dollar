// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IFraxETHMinter {
    function submitAndDeposit(address recipient)
        external
        payable
        returns (uint256 shares);
}

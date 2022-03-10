// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.0;

interface ICurveGauge {
    function balanceOf(address account) external view returns (uint256);

    function deposit(uint256 value, address account) external;

    function withdraw(uint256 value) external;
}

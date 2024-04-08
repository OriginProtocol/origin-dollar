// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface ICVXLocker {
    function lock(
        address _account,
        uint256 _amount,
        uint256 _spendRatio
    ) external;

    function lockedBalanceOf(address _account) external view returns (uint256);
}

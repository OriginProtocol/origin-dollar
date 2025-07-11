// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

interface IConvexDeposits {
    function deposit(
        uint256 _pid,
        uint256 _amount,
        bool _stake
    ) external returns (bool);

    function deposit(
        uint256 _amount,
        bool _lock,
        address _stakeAddress
    ) external;
}

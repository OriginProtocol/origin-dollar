// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity ^0.8.0;

interface IVotingDistributor {
    function lastEpoch() external view returns (uint256);
}

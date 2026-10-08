// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity ^0.8.0;

import { IMaverickV2Pool } from "./IMaverickV2Pool.sol";

interface IPoolDistributor {
    function rewardToken() external view returns (address);

    function claimLp(
        address recipient,
        uint256 tokenId,
        IMaverickV2Pool pool,
        uint32[] memory binIds,
        uint256 epoch
    ) external returns (uint256 amount);
}

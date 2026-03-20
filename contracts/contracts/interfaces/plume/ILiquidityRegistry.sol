// SPDX-License-Identifier: GPL-2.0-or-later
// As the copyright holder of this work, Ubiquity Labs retains
// the right to distribute, use, and modify this code under any license of
// their choosing, in addition to the terms of the GPL-v2 or later.
pragma solidity ^0.8.25;

import { IMaverickV2Pool } from "./IMaverickV2Pool.sol";

interface ILiquidityRegistry {
    function notifyBinLiquidity(
        IMaverickV2Pool pool,
        uint256 tokenId,
        uint32 binId,
        uint256 currentBinLpBalance
    ) external;
}

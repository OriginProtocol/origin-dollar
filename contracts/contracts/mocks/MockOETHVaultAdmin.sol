// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import { OETHVault } from "../vault/OETHVault.sol";

contract MockOETHVault is OETHVault {
    constructor(address _weth) OETHVault(_weth) {}

    // fetches the WETH amount in outstanding withdrawals
    function outstandingWithdrawalsAmount()
        external
        view
        returns (uint256 wethAmount)
    {
        WithdrawalQueueMetadata memory queue = withdrawalQueueMetadata;

        // The amount of WETH that is still to be claimed in the withdrawal queue
        wethAmount = queue.queued - queue.claimed;
    }

    function wethAvailable() external view returns (uint256) {
        return _assetAvailable();
    }
}

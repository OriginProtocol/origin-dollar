// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {VaultStorage} from "contracts/vault/VaultStorage.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @notice Minimal mock vault for AutoWithdrawalModule tests.
///         Exposes setters for withdrawal queue metadata and asset.
contract MockAutoWithdrawalVault {
    address public asset;
    VaultStorage.WithdrawalQueueMetadata internal _queueMetadata;

    bool public withdrawFromStrategyCalled;
    address public lastWithdrawStrategy;
    uint256 public lastWithdrawAmount;

    constructor(address _asset) {
        asset = _asset;
    }

    function setQueueMetadata(uint128 queued, uint128 claimable) external {
        _queueMetadata.queued = queued;
        _queueMetadata.claimable = claimable;
    }

    function withdrawalQueueMetadata()
        external
        view
        returns (VaultStorage.WithdrawalQueueMetadata memory)
    {
        return _queueMetadata;
    }

    function addWithdrawalQueueLiquidity() external {
        // noop in mock
    }

    function withdrawFromStrategy(
        address _strategy,
        address[] calldata,
        uint256[] calldata _amounts
    ) external {
        withdrawFromStrategyCalled = true;
        lastWithdrawStrategy = _strategy;
        lastWithdrawAmount = _amounts[0];
    }
}

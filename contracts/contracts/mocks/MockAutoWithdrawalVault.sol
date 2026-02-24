// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import { VaultStorage } from "../vault/VaultStorage.sol";

contract MockAutoWithdrawalVault {
    address public asset;

    VaultStorage.WithdrawalQueueMetadata public withdrawalQueueMetadata;

    bool private _revertNextWithdraw;

    event MockedWithdrawal(address strategy, address asset, uint256 amount);

    constructor(address _asset) {
        asset = _asset;
    }

    function setWithdrawalQueueMetadata(uint256 queued, uint256 claimable)
        external
    {
        withdrawalQueueMetadata.queued = uint128(queued);
        withdrawalQueueMetadata.claimable = uint128(claimable);
    }

    function revertNextWithdraw() external {
        _revertNextWithdraw = true;
    }

    function addWithdrawalQueueLiquidity() external {
        // Do nothing
    }

    function withdrawFromStrategy(
        address strategy,
        address[] memory assets,
        uint256[] memory amounts
    ) external {
        if (_revertNextWithdraw) {
            _revertNextWithdraw = false;
            revert("Mocked withdrawal revert");
        }
        emit MockedWithdrawal(strategy, assets[0], amounts[0]);
    }
}

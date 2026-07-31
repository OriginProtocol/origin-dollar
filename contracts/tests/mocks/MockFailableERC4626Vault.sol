// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {MockERC4626Vault} from "contracts/mocks/MockERC4626Vault.sol";

/// @dev Extended mock that can be toggled to fail on deposit/withdraw
contract MockFailableERC4626Vault is MockERC4626Vault {
    bool public shouldFailDeposit;
    bool public shouldFailWithdraw;
    bool public shouldRevertLowLevel;

    constructor(address _asset) MockERC4626Vault(_asset) {}

    function setDepositFail(bool _fail) external {
        shouldFailDeposit = _fail;
    }

    function setWithdrawFail(bool _fail) external {
        shouldFailWithdraw = _fail;
    }

    function setRevertLowLevel(bool _revertLow) external {
        shouldRevertLowLevel = _revertLow;
    }

    function deposit(uint256 assets, address receiver) public override returns (uint256 shares) {
        if (shouldFailDeposit) {
            if (shouldRevertLowLevel) {
                // Low-level revert (no string)
                revert();
            }
            revert("Deposit paused");
        }
        return super.deposit(assets, receiver);
    }

    function withdraw(uint256 assets, address receiver, address owner) public override returns (uint256 shares) {
        if (shouldFailWithdraw) {
            if (shouldRevertLowLevel) {
                revert();
            }
            revert("Withdraw paused");
        }
        return super.withdraw(assets, receiver, owner);
    }
}

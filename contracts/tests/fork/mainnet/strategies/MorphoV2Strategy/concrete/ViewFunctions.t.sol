// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Mainnet} from "tests/utils/Addresses.sol";

import {Fork_MorphoV2Strategy_Shared_Test} from "tests/fork/mainnet/strategies/MorphoV2Strategy/shared/Shared.t.sol";

contract Fork_Concrete_MorphoV2Strategy_ViewFunctions_Test is Fork_MorphoV2Strategy_Shared_Test {
    function test_checkBalance_afterDeposit() public {
        uint256 amount = 10_000e6;

        _depositAsVault(amount);

        uint256 balance = strategy.checkBalance(Mainnet.USDC);
        assertApproxEqRel(balance, amount, 1e16); // 1% tolerance
    }

    function test_maxWithdraw_afterDeposit() public {
        _depositAsVault(10_000e6);

        uint256 maxW = strategy.maxWithdraw();
        assertGt(maxW, 0);
    }

    function test_supportsAsset_usdc() public view {
        assertTrue(strategy.supportsAsset(Mainnet.USDC));
    }

    function test_supportsAsset_nonUsdc() public view {
        assertFalse(strategy.supportsAsset(Mainnet.WETH));
    }

    function test_platformAddress() public view {
        assertEq(strategy.platformAddress(), Mainnet.MorphoOUSDv2Vault);
    }

    function test_assetToken() public view {
        assertEq(address(strategy.assetToken()), Mainnet.USDC);
    }
}

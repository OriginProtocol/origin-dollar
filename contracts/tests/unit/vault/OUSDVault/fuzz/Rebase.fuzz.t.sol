// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Unit_Shared_Test} from "tests/unit/vault/OUSDVault/shared/Shared.t.sol";
import {MockERC20} from "@solmate/test/utils/mocks/MockERC20.sol";

contract Unit_Fuzz_OUSDVault_Rebase_Test is Unit_Shared_Test {
    //////////////////////////////////////////////////////
    /// --- REBASE FUZZ TESTS
    //////////////////////////////////////////////////////

    /// @notice totalSupply increases by yield * 1e12 when under both caps
    function testFuzz_rebase_totalSupplyIncrease(uint256 yield_) public {
        yield_ = bound(yield_, 1, 3e5); // USDC amount, small enough to stay under caps

        uint256 supplyBefore = ousd.totalSupply();

        _injectYield(yield_);

        // Warp 1 day so per-second cap allows yield through
        vm.warp(block.timestamp + 1 days);
        ousdVault.rebase();

        assertEq(ousd.totalSupply(), supplyBefore + yield_ * 1e12);
    }

    /// @notice supply increase is capped by MAX_REBASE (2%) when yield exceeds caps
    function testFuzz_rebase_yieldCappedByMaxRebase(uint256 yield_) public {
        yield_ = bound(yield_, 5e6, 100e6); // Large yield that will exceed caps

        uint256 supplyBefore = ousd.totalSupply();
        uint256 rebasingSupply = ousd.totalSupply() - ousd.nonRebasingSupply();

        _injectYield(yield_);

        // Warp 30 days so per-second cap is generous, but MAX_REBASE (2%) still caps
        vm.warp(block.timestamp + 30 days);
        ousdVault.rebase();

        uint256 supplyIncrease = ousd.totalSupply() - supplyBefore;
        uint256 maxRebaseCap = (rebasingSupply * 2) / 100; // 2% of rebasing supply

        assertLe(supplyIncrease, maxRebaseCap + 1); // 1 wei tolerance
    }

    /// @notice non-rebasing balance remains unchanged after yield
    function testFuzz_rebase_nonRebasingExcluded(uint256 yield_, uint256 pct) public {
        yield_ = bound(yield_, 1, 3e5);
        pct = bound(pct, 10, 90);

        // Transfer pct% of josh's OUSD to the non-rebasing contract
        uint256 joshBal = ousd.balanceOf(josh);
        uint256 transferAmt = (joshBal * pct) / 100;

        vm.prank(josh);
        ousd.transfer(address(mockNonRebasing), transferAmt);

        uint256 nonRebasingBefore = ousd.balanceOf(address(mockNonRebasing));

        _injectYield(yield_);
        vm.warp(block.timestamp + 1 days);
        ousdVault.rebase();

        assertEq(ousd.balanceOf(address(mockNonRebasing)), nonRebasingBefore);
    }

    /// @notice two users with equal balances get equal yield
    function testFuzz_rebase_equalUsersGetEqualYield(uint256 yield_) public {
        yield_ = bound(yield_, 1e3, 3e5);

        // matt and josh each start with 100 OUSD from setUp
        uint256 mattBefore = ousd.balanceOf(matt);
        uint256 joshBefore = ousd.balanceOf(josh);
        assertEq(mattBefore, joshBefore);

        _injectYield(yield_);
        vm.warp(block.timestamp + 1 days);
        ousdVault.rebase();

        uint256 mattGain = ousd.balanceOf(matt) - mattBefore;
        uint256 joshGain = ousd.balanceOf(josh) - joshBefore;

        assertApproxEqAbs(mattGain, joshGain, 2); // 2 wei tolerance
    }

    /// @notice trustee receives yield * bps / 10000
    function testFuzz_rebase_trusteeFee(uint256 yield_, uint256 bps) public {
        yield_ = bound(yield_, 1e3, 3e5);
        bps = bound(bps, 1, 5000);

        vm.startPrank(governor);
        ousdVault.setTrusteeAddress(address(mockNonRebasing));
        ousdVault.setTrusteeFeeBps(bps);
        vm.stopPrank();

        assertEq(ousd.balanceOf(address(mockNonRebasing)), 0);

        _injectYield(yield_);
        vm.warp(block.timestamp + 1 days);
        ousdVault.rebase();

        uint256 scaledYield = yield_ * 1e12;
        uint256 expectedFee = (scaledYield * bps) / 10000;

        assertApproxEqAbs(ousd.balanceOf(address(mockNonRebasing)), expectedFee, 1e12);
    }

    /// @notice yield distribution is proportional to user balances
    function testFuzz_rebase_proportionalDistribution(
        uint256 yield_,
        uint256 aliceMint,
        uint256 bobbyMint
    ) public {
        yield_ = bound(yield_, 1e4, 3e5);
        aliceMint = bound(aliceMint, 1e6, 1e9);
        bobbyMint = bound(bobbyMint, 1e6, 1e9);

        // Mint OUSD for alice and bobby
        _mintOUSD(alice, aliceMint);
        _mintOUSD(bobby, bobbyMint);

        // Opt in alice and bobby for rebasing (EOAs are rebasing by default)
        uint256 aliceBefore = ousd.balanceOf(alice);
        uint256 bobbyBefore = ousd.balanceOf(bobby);

        _injectYield(yield_);
        vm.warp(block.timestamp + 1 days);
        ousdVault.rebase();

        uint256 aliceGain = ousd.balanceOf(alice) - aliceBefore;
        uint256 bobbyGain = ousd.balanceOf(bobby) - bobbyBefore;

        // Cross-multiply: aliceGain * bobbyBefore ≈ bobbyGain * aliceBefore
        // Use relative tolerance since both sides can be large
        if (aliceGain > 0 && bobbyGain > 0) {
            uint256 lhs = aliceGain * bobbyBefore;
            uint256 rhs = bobbyGain * aliceBefore;
            uint256 diff = lhs > rhs ? lhs - rhs : rhs - lhs;
            uint256 maxVal = lhs > rhs ? lhs : rhs;
            // Allow 0.1% relative error + absolute buffer for rounding
            assertLe(diff, maxVal / 1000 + 1e18);
        }
    }

    //////////////////////////////////////////////////////
    /// --- HELPERS
    //////////////////////////////////////////////////////

    /// @dev Inject yield into the vault by dealing USDC and transferring directly
    function _injectYield(uint256 usdcAmount) internal {
        _dealUSDC(address(this), usdcAmount);
        MockERC20(address(usdc)).transfer(address(ousdVault), usdcAmount);
    }
}

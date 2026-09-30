// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {Fork_RemoteWOTokenStrategy_Shared_Test} from "../shared/Shared.t.sol";

// --- Test utilities
import {Mainnet} from "tests/utils/Addresses.sol";

// --- External libraries
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

// --- Project imports
import {IVault} from "contracts/interfaces/IVault.sol";
import {VaultStorage} from "contracts/vault/VaultStorage.sol";

/// @notice The two-leg withdrawal against the real OETH vault withdrawal queue.
///
///         Unit tests cover the state machine against a mock vault. What only a fork can show
///         is that the pieces line up with the live vault: that `requestWithdrawal` returns a
///         usable id, that the claim delay behaves as assumed, and — the invariant that matters
///         for `checkBalance` — that value moves between the share, queue and asset slots
///         without ever being counted twice or dropped.
contract Fork_RemoteWOTokenStrategy_Withdrawal_Test is Fork_RemoteWOTokenStrategy_Shared_Test {
    /// @dev `RemoteWOTokenStrategy.REQUEST_ID_EMPTY` — the "no outstanding request" sentinel.
    ///      It is `type(uint256).max` rather than 0 so a genuine `requestId` of 0 is unambiguous.
    uint256 internal constant REQUEST_ID_EMPTY = type(uint256).max;

    uint256 internal constant WITHDRAW_AMOUNT = 1 ether;

    function test_withdrawRequest_unwrapsSharesAndQueues() public {
        uint256 totalBefore = remote.checkBalance(Mainnet.WETH);
        uint256 sharesBefore = woeth.balanceOf(address(remote));
        assertGt(sharesBefore, 0, "no wOETH seeded");

        _deliverAndMeasure(_envelope(WITHDRAW_REQUEST, 1, abi.encode(WITHDRAW_AMOUNT)), 0);

        assertLt(woeth.balanceOf(address(remote)), sharesBefore, "shares not unwrapped");
        assertEq(remote.outstandingRequestAmount(), WITHDRAW_AMOUNT, "request amount not recorded");
        assertNotEq(remote.outstandingRequestId(), REQUEST_ID_EMPTY, "no request queued");

        // Value moved from the share slot into the queue slot — the total is unchanged. 1 wei of
        // slack for the wOETH<->OETH conversion rounding.
        assertApproxEqAbs(remote.checkBalance(Mainnet.WETH), totalBefore, 1, "checkBalance not preserved");
    }

    function test_claimRemoteWithdrawal_paysOutAfterTheDelay() public {
        _deliverAndMeasure(_envelope(WITHDRAW_REQUEST, 1, abi.encode(WITHDRAW_AMOUNT)), 0);
        assertNotEq(remote.outstandingRequestId(), REQUEST_ID_EMPTY, "no request queued");

        uint256 totalBefore = remote.checkBalance(Mainnet.WETH);
        uint256 wethBefore = IERC20(Mainnet.WETH).balanceOf(address(remote));

        // Past the vault's `withdrawalClaimDelay`, with the live queue shortfall covered.
        // Permissionless — the operator cadence calls it, but anyone can.
        _claimWithLiquidity();

        // The sentinel id is what marks the request closed; `outstandingRequestAmount` is
        // deliberately left holding the vault's actually-paid amount so leg 2 ships exactly
        // that. Asserting it still equals the request is the round-trip identity the strategy
        // relies on: the vault stores the queued 18dp amount and returns it unscaled when
        // bridgeAsset and the vault asset share decimals, which on this pair they do.
        assertEq(remote.outstandingRequestId(), REQUEST_ID_EMPTY, "request not closed");
        assertEq(remote.outstandingRequestAmount(), WITHDRAW_AMOUNT, "claimed != requested");
        assertEq(IERC20(Mainnet.WETH).balanceOf(address(remote)), wethBefore + WITHDRAW_AMOUNT, "WETH not received");

        // Queue slot -> asset slot. Still the same total.
        assertApproxEqAbs(remote.checkBalance(Mainnet.WETH), totalBefore, 1, "checkBalance not preserved");
    }

    /// @dev The claim is driven by an unpermissioned cadence, so a double-fire has to be a
    ///      no-op rather than a revert — otherwise a retry storm bricks the operator loop.
    function test_claimRemoteWithdrawal_isIdempotent() public {
        _deliverAndMeasure(_envelope(WITHDRAW_REQUEST, 1, abi.encode(WITHDRAW_AMOUNT)), 0);

        _claimWithLiquidity();
        uint256 wethAfterFirst = IERC20(Mainnet.WETH).balanceOf(address(remote));

        // Second call sees the empty sentinel and early-returns.
        remote.claimRemoteWithdrawal();

        assertEq(remote.outstandingRequestId(), REQUEST_ID_EMPTY, "request not closed");
        assertEq(IERC20(Mainnet.WETH).balanceOf(address(remote)), wethAfterFirst, "second claim moved funds");
    }

    /// @dev Claimed-but-unshipped WETH belongs to leg 2. If `retryDeposit` re-wrapped it, leg 2
    ///      would NACK forever and Master's pending withdrawal would block the channel.
    function test_retryDeposit_leavesClaimedWithdrawalForLeg2() public {
        _deliverAndMeasure(_envelope(WITHDRAW_REQUEST, 1, abi.encode(WITHDRAW_AMOUNT)), 0);
        _claimWithLiquidity();

        // Unrelated idle WETH alongside the claimed proceeds — only this should be re-wrapped.
        uint256 extra = 0.5 ether;
        uint256 wethClaimed = IERC20(Mainnet.WETH).balanceOf(address(remote));
        deal(Mainnet.WETH, address(remote), wethClaimed + extra);
        uint256 sharesBefore = woeth.balanceOf(address(remote));

        vm.prank(governor);
        remote.retryDeposit();

        assertEq(IERC20(Mainnet.WETH).balanceOf(address(remote)), wethClaimed, "reserved WETH re-wrapped");
        assertGt(woeth.balanceOf(address(remote)), sharesBefore, "idle WETH not wrapped");

        // Leg 2 still ships the full claimed amount.
        _deliverAndMeasure(_envelope(WITHDRAW_CLAIM, 2, ""), 0);
        assertEq(remote.outstandingRequestAmount(), 0, "leg 2 did not ship");
        assertEq(IERC20(Mainnet.WETH).balanceOf(address(remote)), wethClaimed - WITHDRAW_AMOUNT, "wrong amount shipped");
    }

    function test_retryDeposit_revertsWhenOnlyClaimedWithdrawalIsIdle() public {
        _deliverAndMeasure(_envelope(WITHDRAW_REQUEST, 1, abi.encode(WITHDRAW_AMOUNT)), 0);
        _claimWithLiquidity();

        vm.prank(governor);
        vm.expectRevert("Remote: nothing to retry");
        remote.retryDeposit();
    }

    /// @dev While the request is still queued nothing is held for it, so no reserve applies.
    function test_retryDeposit_wrapsAllIdleWethWhileRequestQueued() public {
        _deliverAndMeasure(_envelope(WITHDRAW_REQUEST, 1, abi.encode(WITHDRAW_AMOUNT)), 0);
        assertNotEq(remote.outstandingRequestId(), REQUEST_ID_EMPTY, "no request queued");

        deal(Mainnet.WETH, address(remote), 0.5 ether);

        vm.prank(governor);
        remote.retryDeposit();

        assertEq(IERC20(Mainnet.WETH).balanceOf(address(remote)), 0, "idle WETH not wrapped");
    }

    /// @dev Warp past the queue delay, cover any live queue shortfall on the OETH vault (the
    ///      fork block can be short of WETH, which makes the claim revert "Queue pending
    ///      liquidity"), then claim and check it landed.
    function _claimWithLiquidity() internal {
        vm.warp(block.timestamp + 11 days);
        vm.roll(block.number + 1);

        IVault vault = IVault(Mainnet.OETHVaultProxy);
        VaultStorage.WithdrawalQueueMetadata memory meta = vault.withdrawalQueueMetadata();
        uint256 shortfall = meta.queued > meta.claimable ? meta.queued - meta.claimable : 0;
        deal(Mainnet.WETH, address(vault), IERC20(Mainnet.WETH).balanceOf(address(vault)) + shortfall);
        vault.addWithdrawalQueueLiquidity();

        remote.claimRemoteWithdrawal();
        assertEq(remote.outstandingRequestId(), REQUEST_ID_EMPTY, "claim did not land");
    }
}

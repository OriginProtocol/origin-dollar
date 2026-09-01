// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {Fork_RemoteWOTokenStrategy_Shared_Test} from "../shared/Shared.t.sol";

// --- Test utilities
import {Mainnet, CrossChain} from "tests/utils/Addresses.sol";

/// @notice Gas budget regression for Remote's inbound handlers.
///
///         Every inbound handler runs inside the CCIP destination callback under the lane's
///         `destGasLimit`, and each one ends with a full outbound CCIP round-trip. Nothing
///         enforced that the two fit together, which is how `WITHDRAW_CLAIM` came to need
///         2.3x the configured budget (CODE_REVIEW.md finding #1).
///
///         These tests pin `block.basefee` to 1 gwei so the OP-Stack deposit burn inside
///         `bridgeETHTo` sits at its ceiling, making the measurement the worst case rather
///         than a function of the fork block.
contract Fork_RemoteWOTokenStrategy_InboundGas_Test is Fork_RemoteWOTokenStrategy_Shared_Test {
    uint32 internal constant LIMIT = CrossChain.OETHB_V3_DEST_GAS_LIMIT_BASE_TO_MAINNET;

    /// @dev `IVault.mint()` calls `_allocate()` above `autoAllocateThreshold`, but `_allocate()`
    ///      itself early-returns while the vault sits at or below its target buffer — which it
    ///      does at most fork blocks. Measuring in that state understates the budget, so the
    ///      buffer is forced to 0 here to make the default strategy's `deposit()` actually run.
    ///      That is the state the budget has to survive, not the cheap one.
    function test_inboundGas_deposit_fitsBudget() public {
        vm.prank(Mainnet.Timelock);
        (bool ok,) = Mainnet.OETHVaultProxy.call(abi.encodeWithSignature("setVaultBuffer(uint256)", uint256(0)));
        require(ok, "setVaultBuffer failed");

        _pinWorstCaseBasefee();

        // Comfortably above `autoAllocateThreshold` (10e18 live). A cross-chain deposit is
        // always larger than the threshold, so this is the realistic size.
        uint256 amount = 50 ether;
        deal(Mainnet.WETH, address(remote), amount);

        uint256 gasUsed = _deliverAndMeasure(_envelope(DEPOSIT, 1, ""), amount);

        emit log_named_uint("DEPOSIT gasUsed (auto-allocate forced)", gasUsed);
        assertLt(gasUsed, LIMIT, "DEPOSIT exceeds destGasLimit");
    }

    function test_inboundGas_withdrawRequest_fitsBudget() public {
        _pinWorstCaseBasefee();

        bytes memory body = abi.encode(uint256(1 ether));
        uint256 gasUsed = _deliverAndMeasure(_envelope(WITHDRAW_REQUEST, 1, body), 0);

        emit log_named_uint("WITHDRAW_REQUEST gasUsed", gasUsed);
        assertLt(gasUsed, LIMIT, "WITHDRAW_REQUEST exceeds destGasLimit");
    }

    /// @dev The one that motivated the change. Runs the full leg-2 path: claim from the OETH
    ///      vault queue, then reply with tokens — which means `bridgeETHTo` (the metered
    ///      OP-Stack deposit) plus `ccipSend`, both inside the callback.
    function test_inboundGas_withdrawClaim_fitsBudget() public {
        _pinWorstCaseBasefee();

        // Leg 1 first: queue a withdrawal so leg 2 has something to claim.
        _deliverAndMeasure(_envelope(WITHDRAW_REQUEST, 1, abi.encode(uint256(1 ether))), 0);

        // The OETH vault queue has a delay; warp past it so the claim actually pays out.
        vm.warp(block.timestamp + 11 days);
        vm.roll(block.number + 1);
        _pinWorstCaseBasefee();

        uint256 gasUsed = _deliverAndMeasure(_envelope(WITHDRAW_CLAIM, 2, ""), 0);

        emit log_named_uint("WITHDRAW_CLAIM gasUsed", gasUsed);
        assertLt(gasUsed, LIMIT, "WITHDRAW_CLAIM exceeds destGasLimit");
    }

    /// @dev Remote pushes this one outbound rather than receiving it, so it is measured on the
    ///      send side. Included because it is the 2h cadence and so the most frequent message.
    function test_outboundGas_balanceReport_fitsBudget() public {
        _pinWorstCaseBasefee();

        vm.prank(operator);
        uint256 before = gasleft();
        remote.sendBalanceReport();
        uint256 gasUsed = before - gasleft();

        emit log_named_uint("BALANCE_REPORT gasUsed", gasUsed);
        // Outbound is not under a CCIP callback cap; this is a drift tripwire, not a budget.
        assertLt(gasUsed, LIMIT, "BALANCE_REPORT unexpectedly expensive");
    }
}

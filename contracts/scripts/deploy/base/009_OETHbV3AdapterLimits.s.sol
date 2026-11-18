// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// Deployment framework
import {AbstractDeployScript} from "scripts/deploy/helpers/AbstractDeployScript.s.sol";
import {GovHelper} from "scripts/deploy/helpers/GovHelper.sol";
import {GovProposal} from "scripts/deploy/helpers/DeploymentTypes.sol";

// Contracts
import {IBridgeAdapter} from "contracts/interfaces/crosschainV3/IBridgeAdapter.sol";

/// @title 009_OETHbV3AdapterLimits
/// @notice Caps each Master -> Remote deposit at the CCIP WETH lane's rate-limit bucket.
/// @dev Only the Base CCIPAdapter (Master's outbound) is capped. Withdrawals are bounded by the
///      Superbridge adapters (Master's inbound here, Remote's outbound on Ethereum), which stay at
///      0 = unlimited: the canonical bridge has no per-tx limit, and the withdraw-request / claim
///      messages that do travel over CCIP are message-only, which the cap does not apply to.
///
///      `minTransferAmount` is not configurable on the deployed adapters (hardcoded 0), so only
///      the max is set here.
contract $009_OETHbV3AdapterLimits is AbstractDeployScript("009_OETHbV3AdapterLimits") {
    using GovHelper for GovProposal;

    /// @notice Per-tx cap on the Base CCIPAdapter.
    /// @dev Just under Chainlink's WETH Base -> Ethereum bucket: 90.75 WETH capacity, refilling at
    ///      ~90.75 WETH/h (Base pool `getCurrentOutboundRateLimiterState`; the Ethereum pool's
    ///      inbound bucket is the looser 100.83). Above the bucket `ccipSend` reverts deep in the
    ///      router; with the cap, `deposit` fails fast and `depositAll` clamps instead. The bucket
    ///      is shared with every user of the lane, so a send can still revert while it refills.
    ///      Chainlink can retune it — re-read the pool before changing this value.
    uint256 internal constant CCIP_MAX_TRANSFER = 90 ether;

    // ==================== Governance Proposal ==================== //

    function _buildGovernanceProposal() internal override {
        govProposal.setDescription(
            "Cap OETHb V3 CCIP deposits at 90 WETH per transaction\n\n"
            "Sets maxTransferAmount on the Base CCIPAdapter to 90 WETH, just under Chainlink's "
            "90.75 WETH rate-limit bucket for WETH Base -> Ethereum. Larger deposits into the "
            "Master strategy now fail fast (deposit) or are clamped (depositAll) instead of "
            "reverting inside the CCIP router. Withdrawals are unaffected."
        );

        govProposal.action(
            resolver.resolve("OETHB_V3_CCIP_ADAPTER_PROXY"),
            "setMaxTransferAmount(uint256)",
            abi.encode(CCIP_MAX_TRANSFER)
        );
    }

    // ==================== Fork Verification ==================== //

    function _fork() internal override {
        require(
            IBridgeAdapter(resolver.resolve("OETHB_V3_CCIP_ADAPTER_PROXY")).maxTransferAmount() == CCIP_MAX_TRANSFER,
            "CCIP adapter cap not set"
        );
        // Withdrawals are bounded by this adapter; it must stay unlimited.
        require(
            IBridgeAdapter(resolver.resolve("OETHB_V3_SUPERBRIDGE_ADAPTER_PROXY")).maxTransferAmount() == 0,
            "Superbridge adapter unexpectedly capped"
        );
    }
}

// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// Deployment framework
import {AbstractDeployScript} from "scripts/deploy/helpers/AbstractDeployScript.s.sol";

// Contracts
import {BaseFeeBridgeModule} from "contracts/automation/BaseFeeBridgeModule.sol";

// Addresses
import {Base, CrossChain, Mainnet} from "tests/utils/Addresses.sol";

/// @title 007_BaseFeeBridgeModule
/// @notice Deploys the Safe module that sells the Super OETH protocol fees for WETH on the Curve
///         AMO pool and bridges the WETH over CCIP to the Ethereum FeeSplitter.
/// @dev Hosted on the fee Safe (multichainBuybackOperator), which is the Base vault's
///      `trusteeAddress` and so receives the fees as OETHb. No governance proposal: the module
///      only spends what that Safe already holds.
///
///      REQUIRED POST-DEPLOY STEPS:
///        - Ethereum: the FeeSplitter Strategist calls `addAsset(WETH, 0.125e18)` BEFORE the
///          first bridge. Until then the FeeSplitter does not distribute WETH, and it can only be
///          recovered through a Governor `rescue`.
///        - Base: the fee Safe calls `enableModule(<module>)` and keeps a small ETH balance for
///          the CCIP fee.
contract $007_BaseFeeBridgeModule is AbstractDeployScript("007_BaseFeeBridgeModule") {
    /// @dev Default floor against par for the OETHb -> WETH swap. The pool sits ~9 bps below par
    ///      today, so 50 bps leaves room without letting a sandwich take much.
    uint256 internal constant MAX_SLIPPAGE_BPS = 50;

    // ==================== Deployment Logic ==================== //

    function _execute() internal override {
        BaseFeeBridgeModule module = new BaseFeeBridgeModule(
            CrossChain.multichainBuybackOperator,
            CrossChain.talosRelayer,
            Base.OETHBaseProxy,
            Base.WETH,
            Base.OETHb_WETH_pool,
            Base.CCIPRouter,
            Mainnet.CCIPChainSelector,
            Mainnet.FeeSplitter,
            MAX_SLIPPAGE_BPS
        );
        _recordDeployment("BaseFeeBridgeModule", address(module), type(BaseFeeBridgeModule).name);
    }

    // ==================== Fork Verification ==================== //

    function _fork() internal override {
        BaseFeeBridgeModule module = BaseFeeBridgeModule(payable(resolver.resolve("BaseFeeBridgeModule")));

        require(address(module.safeContract()) == CrossChain.multichainBuybackOperator, "Wrong Safe");
        require(module.feeSplitter() == Mainnet.FeeSplitter, "Wrong fee splitter");
        require(module.destinationChainSelector() == Mainnet.CCIPChainSelector, "Wrong destination");
        require(module.hasRole(module.OPERATOR_ROLE(), CrossChain.talosRelayer), "Operator role not set");

        // Enabling the module is a Safe transaction, not part of any proposal, so it has to be
        // simulated here for the fork tests to exercise the module at all. Guarded because
        // `_fork()` is re-run by every later suite and Safe reverts on a double enable.
        ISafeModuleManager safe = ISafeModuleManager(CrossChain.multichainBuybackOperator);
        if (!safe.isModuleEnabled(address(module))) {
            vm.prank(CrossChain.multichainBuybackOperator);
            safe.enableModule(address(module));
        }
        require(safe.isModuleEnabled(address(module)), "Module not enabled on the Safe");
    }
}

// ==================== External Interface ==================== //

/// @notice Module management surface on a Gnosis Safe. Not part of ISafe, which only carries the
///         `execTransactionFromModule` call the modules themselves make.
interface ISafeModuleManager {
    function enableModule(address module) external;
    function isModuleEnabled(address module) external view returns (bool);
}

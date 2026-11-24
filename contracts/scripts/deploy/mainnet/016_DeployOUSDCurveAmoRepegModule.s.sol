// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.28;

import {console2} from "forge-std/console2.sol";
import {AbstractDeployScript} from "scripts/deploy/helpers/AbstractDeployScript.s.sol";
import {CrossChain, Mainnet} from "tests/utils/Addresses.sol";
import {IVault} from "contracts/interfaces/IVault.sol";
import {ICurveAMOStrategy} from "contracts/interfaces/strategies/ICurveAMOStrategy.sol";
import {VaultValueChecker} from "contracts/strategies/VaultValueChecker.sol";
import {CurveAmoRepegModule} from "contracts/automation/CurveAmoRepegModule.sol";

/// @notice Deploys the OUSD instance without enabling it on the strategist Safe.
contract $016_DeployOUSDCurveAmoRepegModule is AbstractDeployScript("016_DeployOUSDCurveAmoRepegModule") {
    // VaultValueChecker has no entry in the Foundry resolver ledger.
    address internal constant CHECKER = 0x25041Ccb8352b9BA65883a94685aeF07a5aD8739;
    uint256 internal constant MAX_PROFIT_VARIANCE = 1e18;
    uint256 internal constant MAX_VAULT_CHANGE_VARIANCE = 1e18;

    function _execute() internal override {
        require(block.chainid == 1, "Ethereum only");
        address safe = CrossChain.multichainStrategist;
        address vault = resolver.resolve("OUSD_VAULT_PROXY");
        address amo = resolver.resolve("OUSD_CURVE_AMO_STRATEGY");
        require(safe.code.length > 0 && vault.code.length > 0 && amo.code.length > 0, "Missing deployed contract");
        require(CHECKER.code.length > 0, "Missing checker");
        require(IVault(vault).strategistAddr() == safe, "Unexpected strategist Safe");
        require(IVault(vault).oToken() == resolver.resolve("OUSD_PROXY"), "Unexpected OToken");
        require(ICurveAMOStrategy(amo).vaultAddress() == vault, "AMO vault mismatch");
        require(ICurveAMOStrategy(amo).curvePool() == Mainnet.curve_OUSD_USDC_pool, "AMO pool mismatch");
        require(address(VaultValueChecker(CHECKER).vault()) == vault, "Checker vault mismatch");
        require(address(VaultValueChecker(CHECKER).ousd()) == IVault(vault).oToken(), "Checker token mismatch");

        CurveAmoRepegModule module = new CurveAmoRepegModule(
            safe, CrossChain.talosRelayer, vault, amo, CHECKER, MAX_PROFIT_VARIANCE, MAX_VAULT_CHANGE_VARIANCE
        );
        _recordDeployment("OUSD_CURVE_AMO_REPEG_MODULE", address(module), type(CurveAmoRepegModule).name);

        console2.log("Strategist Safe:", safe);
        console2.log("Safe enableModule calldata (separate owner transaction):");
        bytes memory enableData = abi.encodeWithSignature("enableModule(address)", address(module));
        console2.logBytes(enableData);
    }

    function _fork() internal view override {
        CurveAmoRepegModule module = CurveAmoRepegModule(payable(resolver.resolve("OUSD_CURVE_AMO_REPEG_MODULE")));
        require(address(module.safeContract()) == CrossChain.multichainStrategist, "Module Safe mismatch");
        require(module.vault() == resolver.resolve("OUSD_VAULT_PROXY"), "Module vault mismatch");
        require(module.amo() == resolver.resolve("OUSD_CURVE_AMO_STRATEGY"), "Module AMO mismatch");
        require(module.checker() == CHECKER, "Module checker mismatch");
        require(module.maxProfitVariance() == MAX_PROFIT_VARIANCE, "Module profit cap mismatch");
        require(module.maxVaultChangeVariance() == MAX_VAULT_CHANGE_VARIANCE, "Module vault cap mismatch");
        require(module.hasRole(module.OPERATOR_ROLE(), CrossChain.talosRelayer), "Relayer not authorized");
        require(module.hasRole(module.DEFAULT_ADMIN_ROLE(), CrossChain.multichainStrategist), "Safe not admin");
        require(module.nonce() == 0, "Unexpected initial nonce");
    }
}

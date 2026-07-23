// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {Unit_CrossChainRemoteStrategy_Shared_Test} from "../shared/Shared.t.sol";

// --- Project imports
import {AbstractCCTPIntegrator} from "contracts/strategies/crosschain/AbstractCCTPIntegrator.sol";
import {CrossChainRemoteStrategy} from "contracts/strategies/crosschain/CrossChainRemoteStrategy.sol";
import {ICrossChainRemoteStrategy} from "contracts/interfaces/strategies/ICrossChainRemoteStrategy.sol";
import {InitializableAbstractStrategy} from "contracts/utils/InitializableAbstractStrategy.sol";

contract Unit_Concrete_CrossChainRemoteStrategy_Admin_Test is Unit_CrossChainRemoteStrategy_Shared_Test {
    //////////////////////////////////////////////////////
    /// --- INITIALIZE
    //////////////////////////////////////////////////////

    function test_initialize_setsStrategist() public view {
        assertEq(crossChainRemoteStrategy.strategistAddr(), strategist);
    }

    function test_initialize_setsOperator() public view {
        assertEq(crossChainRemoteStrategy.operator(), operatorAddr);
    }

    function test_initialize_setsMinFinalityThreshold() public view {
        assertEq(crossChainRemoteStrategy.minFinalityThreshold(), 2000);
    }

    function test_initialize_setsFeePremiumBps() public view {
        assertEq(crossChainRemoteStrategy.feePremiumBps(), 0);
    }

    function test_initialize_setsNonceZeroAsProcessed() public view {
        assertTrue(crossChainRemoteStrategy.isNonceProcessed(0));
    }

    function test_initialize_setsAssetMapping() public view {
        // assetToPToken(usdcToken) should be the 4626 vault
        assertEq(crossChainRemoteStrategy.assetToPToken(address(mockUsdc)), address(mockERC4626Vault));
    }

    function test_initialize_RevertWhen_calledTwice() public {
        vm.prank(governor);
        vm.expectRevert("Initializable: contract is already initialized");
        crossChainRemoteStrategy.initialize(strategist, operatorAddr, 2000, 0);
    }

    function test_initialize_RevertWhen_calledByNonGovernor() public {
        // Deploy fresh strategy
        CrossChainRemoteStrategy freshStrategy = new CrossChainRemoteStrategy(
            InitializableAbstractStrategy.BaseStrategyConfig({
                platformAddress: address(mockERC4626Vault), vaultAddress: address(0)
            }),
            AbstractCCTPIntegrator.CCTPIntegrationConfig({
                cctpTokenMessenger: address(cctpTokenMessengerMock),
                cctpMessageTransmitter: address(cctpMessageTransmitterMock),
                peerDomainID: 0,
                peerStrategy: peerStrategy,
                usdcToken: address(mockUsdc),
                peerUsdcToken: address(peerUsdc)
            })
        );
        vm.store(address(freshStrategy), GOVERNOR_SLOT, bytes32(uint256(uint160(governor))));

        vm.prank(alice);
        vm.expectRevert("Caller is not the Governor");
        freshStrategy.initialize(strategist, operatorAddr, 2000, 0);
    }

    //////////////////////////////////////////////////////
    /// --- SET OPERATOR
    //////////////////////////////////////////////////////

    function test_setOperator_updatesOperator() public {
        vm.prank(governor);
        crossChainRemoteStrategy.setOperator(alice);

        assertEq(crossChainRemoteStrategy.operator(), alice);
    }

    function test_setOperator_emitsOperatorChanged() public {
        vm.expectEmit(true, true, true, true);
        emit ICrossChainRemoteStrategy.OperatorChanged(alice);

        vm.prank(governor);
        crossChainRemoteStrategy.setOperator(alice);
    }

    function test_setOperator_RevertWhen_calledByNonGovernor() public {
        vm.prank(alice);
        vm.expectRevert("Caller is not the Governor");
        crossChainRemoteStrategy.setOperator(alice);
    }

    //////////////////////////////////////////////////////
    /// --- SET MIN FINALITY THRESHOLD
    //////////////////////////////////////////////////////

    function test_setMinFinalityThreshold_setsTo1000() public {
        vm.prank(governor);
        crossChainRemoteStrategy.setMinFinalityThreshold(1000);

        assertEq(crossChainRemoteStrategy.minFinalityThreshold(), 1000);
    }

    function test_setMinFinalityThreshold_setsTo2000() public {
        vm.prank(governor);
        crossChainRemoteStrategy.setMinFinalityThreshold(1000);

        vm.prank(governor);
        crossChainRemoteStrategy.setMinFinalityThreshold(2000);

        assertEq(crossChainRemoteStrategy.minFinalityThreshold(), 2000);
    }

    function test_setMinFinalityThreshold_emitsEvent() public {
        vm.expectEmit(true, true, true, true);
        emit ICrossChainRemoteStrategy.CCTPMinFinalityThresholdSet(1000);

        vm.prank(governor);
        crossChainRemoteStrategy.setMinFinalityThreshold(1000);
    }

    function test_setMinFinalityThreshold_RevertWhen_invalidValue() public {
        vm.prank(governor);
        vm.expectRevert("Invalid threshold");
        crossChainRemoteStrategy.setMinFinalityThreshold(1001);
    }

    function test_setMinFinalityThreshold_RevertWhen_calledByNonGovernor() public {
        vm.prank(alice);
        vm.expectRevert("Caller is not the Governor");
        crossChainRemoteStrategy.setMinFinalityThreshold(2000);
    }

    //////////////////////////////////////////////////////
    /// --- SET FEE PREMIUM BPS
    //////////////////////////////////////////////////////

    function test_setFeePremiumBps_setsValue() public {
        vm.prank(governor);
        crossChainRemoteStrategy.setFeePremiumBps(1000);

        assertEq(crossChainRemoteStrategy.feePremiumBps(), 1000);
    }

    function test_setFeePremiumBps_emitsEvent() public {
        vm.expectEmit(true, true, true, true);
        emit ICrossChainRemoteStrategy.CCTPFeePremiumBpsSet(1000);

        vm.prank(governor);
        crossChainRemoteStrategy.setFeePremiumBps(1000);
    }

    function test_setFeePremiumBps_setsMaxAllowed() public {
        vm.prank(governor);
        crossChainRemoteStrategy.setFeePremiumBps(3000);

        assertEq(crossChainRemoteStrategy.feePremiumBps(), 3000);
    }

    function test_setFeePremiumBps_RevertWhen_tooHigh() public {
        vm.prank(governor);
        vm.expectRevert("Fee premium too high");
        crossChainRemoteStrategy.setFeePremiumBps(3001);
    }

    function test_setFeePremiumBps_RevertWhen_calledByNonGovernor() public {
        vm.prank(alice);
        vm.expectRevert("Caller is not the Governor");
        crossChainRemoteStrategy.setFeePremiumBps(500);
    }

    //////////////////////////////////////////////////////
    /// --- SET STRATEGIST ADDR
    //////////////////////////////////////////////////////

    function test_setStrategistAddr_updatesStrategist() public {
        vm.prank(governor);
        crossChainRemoteStrategy.setStrategistAddr(bobby);

        assertEq(crossChainRemoteStrategy.strategistAddr(), bobby);
    }

    function test_setStrategistAddr_RevertWhen_calledByNonGovernor() public {
        vm.prank(alice);
        vm.expectRevert("Caller is not the Governor");
        crossChainRemoteStrategy.setStrategistAddr(alice);
    }

    //////////////////////////////////////////////////////
    /// --- CONSTRUCTOR VALIDATIONS
    //////////////////////////////////////////////////////

    // Note: "Token mismatch" check (line 60) is unreachable because both usdcToken
    // and assetToken are set from _cctpConfig.usdcToken in the current constructor.

    function test_constructor_RevertWhen_platformAddressIsZero() public {
        vm.expectRevert("Invalid platform address");
        new CrossChainRemoteStrategy(
            InitializableAbstractStrategy.BaseStrategyConfig({platformAddress: address(0), vaultAddress: address(0)}),
            AbstractCCTPIntegrator.CCTPIntegrationConfig({
                cctpTokenMessenger: address(cctpTokenMessengerMock),
                cctpMessageTransmitter: address(cctpMessageTransmitterMock),
                peerDomainID: 0,
                peerStrategy: peerStrategy,
                usdcToken: address(mockUsdc),
                peerUsdcToken: address(peerUsdc)
            })
        );
    }

    function test_constructor_RevertWhen_vaultAddressNotZero() public {
        vm.expectRevert("Invalid vault address");
        new CrossChainRemoteStrategy(
            InitializableAbstractStrategy.BaseStrategyConfig({
                platformAddress: address(mockERC4626Vault), vaultAddress: address(1)
            }),
            AbstractCCTPIntegrator.CCTPIntegrationConfig({
                cctpTokenMessenger: address(cctpTokenMessengerMock),
                cctpMessageTransmitter: address(cctpMessageTransmitterMock),
                peerDomainID: 0,
                peerStrategy: peerStrategy,
                usdcToken: address(mockUsdc),
                peerUsdcToken: address(peerUsdc)
            })
        );
    }
}

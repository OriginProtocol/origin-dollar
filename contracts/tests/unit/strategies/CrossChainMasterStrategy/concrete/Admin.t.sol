// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {Unit_CrossChainMasterStrategy_Shared_Test} from "../shared/Shared.t.sol";

// --- External libraries
import {MockERC20} from "@solmate/test/utils/mocks/MockERC20.sol";

// --- Project imports
import {AbstractCCTPIntegrator} from "contracts/strategies/crosschain/AbstractCCTPIntegrator.sol";
import {CrossChainMasterStrategy} from "contracts/strategies/crosschain/CrossChainMasterStrategy.sol";
import {ICrossChainMasterStrategy} from "contracts/interfaces/strategies/ICrossChainMasterStrategy.sol";
import {InitializableAbstractStrategy} from "contracts/utils/InitializableAbstractStrategy.sol";

contract Unit_Concrete_CrossChainMasterStrategy_Admin_Test is Unit_CrossChainMasterStrategy_Shared_Test {
    //////////////////////////////////////////////////////
    /// --- INITIALIZE
    //////////////////////////////////////////////////////

    function test_initialize_setsOperator() public view {
        assertEq(crossChainMasterStrategy.operator(), operatorAddr);
    }

    function test_initialize_setsMinFinalityThreshold() public view {
        assertEq(crossChainMasterStrategy.minFinalityThreshold(), 2000);
    }

    function test_initialize_setsFeePremiumBps() public view {
        assertEq(crossChainMasterStrategy.feePremiumBps(), 0);
    }

    function test_initialize_setsNonceZeroAsProcessed() public view {
        assertTrue(crossChainMasterStrategy.isNonceProcessed(0));
    }

    function test_initialize_RevertWhen_calledTwice() public {
        vm.prank(governor);
        vm.expectRevert("Initializable: contract is already initialized");
        crossChainMasterStrategy.initialize(operatorAddr, 2000, 0);
    }

    function test_initialize_RevertWhen_calledByNonGovernor() public {
        // Deploy a fresh strategy to test initialize access
        CrossChainMasterStrategy freshStrategy = new CrossChainMasterStrategy(
            InitializableAbstractStrategy.BaseStrategyConfig({
                platformAddress: address(0), vaultAddress: address(ousdVault)
            }),
            AbstractCCTPIntegrator.CCTPIntegrationConfig({
                cctpTokenMessenger: address(cctpTokenMessengerMock),
                cctpMessageTransmitter: address(cctpMessageTransmitterMock),
                peerDomainID: 6,
                peerStrategy: peerStrategy,
                usdcToken: address(mockUsdc),
                peerUsdcToken: address(peerUsdc)
            })
        );
        vm.store(address(freshStrategy), GOVERNOR_SLOT, bytes32(uint256(uint160(governor))));

        vm.prank(alice);
        vm.expectRevert("Caller is not the Governor");
        freshStrategy.initialize(operatorAddr, 2000, 0);
    }

    //////////////////////////////////////////////////////
    /// --- SET OPERATOR
    //////////////////////////////////////////////////////

    function test_setOperator_updatesOperator() public {
        vm.prank(governor);
        crossChainMasterStrategy.setOperator(alice);

        assertEq(crossChainMasterStrategy.operator(), alice);
    }

    function test_setOperator_emitsOperatorChanged() public {
        vm.expectEmit(true, true, true, true);
        emit ICrossChainMasterStrategy.OperatorChanged(alice);

        vm.prank(governor);
        crossChainMasterStrategy.setOperator(alice);
    }

    function test_setOperator_RevertWhen_calledByNonGovernor() public {
        vm.prank(alice);
        vm.expectRevert("Caller is not the Governor");
        crossChainMasterStrategy.setOperator(alice);
    }

    //////////////////////////////////////////////////////
    /// --- SET MIN FINALITY THRESHOLD
    //////////////////////////////////////////////////////

    function test_setMinFinalityThreshold_setsTo1000() public {
        vm.prank(governor);
        crossChainMasterStrategy.setMinFinalityThreshold(1000);

        assertEq(crossChainMasterStrategy.minFinalityThreshold(), 1000);
    }

    function test_setMinFinalityThreshold_setsTo2000() public {
        // First set to 1000, then back to 2000
        vm.prank(governor);
        crossChainMasterStrategy.setMinFinalityThreshold(1000);

        vm.prank(governor);
        crossChainMasterStrategy.setMinFinalityThreshold(2000);

        assertEq(crossChainMasterStrategy.minFinalityThreshold(), 2000);
    }

    function test_setMinFinalityThreshold_emitsEvent() public {
        vm.expectEmit(true, true, true, true);
        emit ICrossChainMasterStrategy.CCTPMinFinalityThresholdSet(1000);

        vm.prank(governor);
        crossChainMasterStrategy.setMinFinalityThreshold(1000);
    }

    function test_setMinFinalityThreshold_RevertWhen_invalidValue() public {
        vm.prank(governor);
        vm.expectRevert("Invalid threshold");
        crossChainMasterStrategy.setMinFinalityThreshold(1500);
    }

    function test_setMinFinalityThreshold_RevertWhen_calledByNonGovernor() public {
        vm.prank(alice);
        vm.expectRevert("Caller is not the Governor");
        crossChainMasterStrategy.setMinFinalityThreshold(2000);
    }

    //////////////////////////////////////////////////////
    /// --- SET FEE PREMIUM BPS
    //////////////////////////////////////////////////////

    function test_setFeePremiumBps_setsValue() public {
        vm.prank(governor);
        crossChainMasterStrategy.setFeePremiumBps(500);

        assertEq(crossChainMasterStrategy.feePremiumBps(), 500);
    }

    function test_setFeePremiumBps_emitsEvent() public {
        vm.expectEmit(true, true, true, true);
        emit ICrossChainMasterStrategy.CCTPFeePremiumBpsSet(500);

        vm.prank(governor);
        crossChainMasterStrategy.setFeePremiumBps(500);
    }

    function test_setFeePremiumBps_setsMaxAllowed() public {
        vm.prank(governor);
        crossChainMasterStrategy.setFeePremiumBps(3000);

        assertEq(crossChainMasterStrategy.feePremiumBps(), 3000);
    }

    function test_setFeePremiumBps_RevertWhen_tooHigh() public {
        vm.prank(governor);
        vm.expectRevert("Fee premium too high");
        crossChainMasterStrategy.setFeePremiumBps(3001);
    }

    function test_setFeePremiumBps_RevertWhen_calledByNonGovernor() public {
        vm.prank(alice);
        vm.expectRevert("Caller is not the Governor");
        crossChainMasterStrategy.setFeePremiumBps(500);
    }

    //////////////////////////////////////////////////////
    /// --- SAFE APPROVE ALL TOKENS
    //////////////////////////////////////////////////////

    function test_safeApproveAllTokens_doesNotRevert() public {
        vm.prank(governor);
        crossChainMasterStrategy.safeApproveAllTokens();
    }

    function test_safeApproveAllTokens_RevertWhen_calledByNonGovernor() public {
        vm.prank(alice);
        vm.expectRevert("Caller is not the Governor");
        crossChainMasterStrategy.safeApproveAllTokens();
    }

    //////////////////////////////////////////////////////
    /// --- SET PTOKEN ADDRESS
    //////////////////////////////////////////////////////

    function test_setPTokenAddress_succeeds() public {
        address asset = makeAddr("SomeAsset");
        address pToken = makeAddr("SomePToken");

        vm.prank(governor);
        crossChainMasterStrategy.setPTokenAddress(asset, pToken);

        // The internal _abstractSetPToken is empty but the parent registers it
        assertEq(crossChainMasterStrategy.assetToPToken(asset), pToken);
    }

    //////////////////////////////////////////////////////
    /// --- COLLECT REWARD TOKENS
    //////////////////////////////////////////////////////

    function test_collectRewardTokens_RevertWhen_calledByNonHarvester() public {
        vm.prank(alice);
        vm.expectRevert("Caller is not the Harvester");
        crossChainMasterStrategy.collectRewardTokens();
    }

    //////////////////////////////////////////////////////
    /// --- CONSTRUCTOR VALIDATIONS
    //////////////////////////////////////////////////////

    function test_constructor_RevertWhen_platformAddressNotZero() public {
        vm.expectRevert("Invalid platform address");
        new CrossChainMasterStrategy(
            InitializableAbstractStrategy.BaseStrategyConfig({
                platformAddress: address(1), // should be address(0)
                vaultAddress: address(ousdVault)
            }),
            AbstractCCTPIntegrator.CCTPIntegrationConfig({
                cctpTokenMessenger: address(cctpTokenMessengerMock),
                cctpMessageTransmitter: address(cctpMessageTransmitterMock),
                peerDomainID: 6,
                peerStrategy: peerStrategy,
                usdcToken: address(mockUsdc),
                peerUsdcToken: address(peerUsdc)
            })
        );
    }

    function test_constructor_RevertWhen_vaultAddressIsZero() public {
        vm.expectRevert("Invalid Vault address");
        new CrossChainMasterStrategy(
            InitializableAbstractStrategy.BaseStrategyConfig({platformAddress: address(0), vaultAddress: address(0)}),
            AbstractCCTPIntegrator.CCTPIntegrationConfig({
                cctpTokenMessenger: address(cctpTokenMessengerMock),
                cctpMessageTransmitter: address(cctpMessageTransmitterMock),
                peerDomainID: 6,
                peerStrategy: peerStrategy,
                usdcToken: address(mockUsdc),
                peerUsdcToken: address(peerUsdc)
            })
        );
    }

    function test_constructor_RevertWhen_usdcAddressIsZero() public {
        vm.expectRevert("Invalid USDC address");
        new CrossChainMasterStrategy(
            InitializableAbstractStrategy.BaseStrategyConfig({
                platformAddress: address(0), vaultAddress: address(ousdVault)
            }),
            AbstractCCTPIntegrator.CCTPIntegrationConfig({
                cctpTokenMessenger: address(cctpTokenMessengerMock),
                cctpMessageTransmitter: address(cctpMessageTransmitterMock),
                peerDomainID: 6,
                peerStrategy: peerStrategy,
                usdcToken: address(0),
                peerUsdcToken: address(peerUsdc)
            })
        );
    }

    function test_constructor_RevertWhen_peerUsdcIsZero() public {
        vm.expectRevert("Invalid peer USDC address");
        new CrossChainMasterStrategy(
            InitializableAbstractStrategy.BaseStrategyConfig({
                platformAddress: address(0), vaultAddress: address(ousdVault)
            }),
            AbstractCCTPIntegrator.CCTPIntegrationConfig({
                cctpTokenMessenger: address(cctpTokenMessengerMock),
                cctpMessageTransmitter: address(cctpMessageTransmitterMock),
                peerDomainID: 6,
                peerStrategy: peerStrategy,
                usdcToken: address(mockUsdc),
                peerUsdcToken: address(0)
            })
        );
    }

    function test_constructor_RevertWhen_cctpTokenMessengerIsZero() public {
        vm.expectRevert("Invalid CCTP config");
        new CrossChainMasterStrategy(
            InitializableAbstractStrategy.BaseStrategyConfig({
                platformAddress: address(0), vaultAddress: address(ousdVault)
            }),
            AbstractCCTPIntegrator.CCTPIntegrationConfig({
                cctpTokenMessenger: address(0),
                cctpMessageTransmitter: address(cctpMessageTransmitterMock),
                peerDomainID: 6,
                peerStrategy: peerStrategy,
                usdcToken: address(mockUsdc),
                peerUsdcToken: address(peerUsdc)
            })
        );
    }

    function test_constructor_RevertWhen_cctpMessageTransmitterIsZero() public {
        vm.expectRevert("Invalid CCTP config");
        new CrossChainMasterStrategy(
            InitializableAbstractStrategy.BaseStrategyConfig({
                platformAddress: address(0), vaultAddress: address(ousdVault)
            }),
            AbstractCCTPIntegrator.CCTPIntegrationConfig({
                cctpTokenMessenger: address(cctpTokenMessengerMock),
                cctpMessageTransmitter: address(0),
                peerDomainID: 6,
                peerStrategy: peerStrategy,
                usdcToken: address(mockUsdc),
                peerUsdcToken: address(peerUsdc)
            })
        );
    }

    function test_constructor_RevertWhen_peerStrategyIsZero() public {
        vm.expectRevert("Invalid peer strategy address");
        new CrossChainMasterStrategy(
            InitializableAbstractStrategy.BaseStrategyConfig({
                platformAddress: address(0), vaultAddress: address(ousdVault)
            }),
            AbstractCCTPIntegrator.CCTPIntegrationConfig({
                cctpTokenMessenger: address(cctpTokenMessengerMock),
                cctpMessageTransmitter: address(cctpMessageTransmitterMock),
                peerDomainID: 6,
                peerStrategy: address(0),
                usdcToken: address(mockUsdc),
                peerUsdcToken: address(peerUsdc)
            })
        );
    }

    function test_constructor_RevertWhen_usdcNotSixDecimals() public {
        MockERC20 badToken = new MockERC20("Bad Token", "USDC", 18);
        vm.expectRevert("Base token decimals must be 6");
        new CrossChainMasterStrategy(
            InitializableAbstractStrategy.BaseStrategyConfig({
                platformAddress: address(0), vaultAddress: address(ousdVault)
            }),
            AbstractCCTPIntegrator.CCTPIntegrationConfig({
                cctpTokenMessenger: address(cctpTokenMessengerMock),
                cctpMessageTransmitter: address(cctpMessageTransmitterMock),
                peerDomainID: 6,
                peerStrategy: peerStrategy,
                usdcToken: address(badToken),
                peerUsdcToken: address(peerUsdc)
            })
        );
    }

    function test_constructor_RevertWhen_usdcNotNamedUSDC() public {
        MockERC20 badToken = new MockERC20("Bad Token", "WETH", 6);
        vm.expectRevert("Token symbol must be USDC");
        new CrossChainMasterStrategy(
            InitializableAbstractStrategy.BaseStrategyConfig({
                platformAddress: address(0), vaultAddress: address(ousdVault)
            }),
            AbstractCCTPIntegrator.CCTPIntegrationConfig({
                cctpTokenMessenger: address(cctpTokenMessengerMock),
                cctpMessageTransmitter: address(cctpMessageTransmitterMock),
                peerDomainID: 6,
                peerStrategy: peerStrategy,
                usdcToken: address(badToken),
                peerUsdcToken: address(peerUsdc)
            })
        );
    }
}

// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Base} from "tests/Base.t.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {MockERC20} from "@solmate/test/utils/mocks/MockERC20.sol";
import {MockFailableERC4626Vault} from "tests/mocks/MockFailableERC4626Vault.sol";
import {CrossChainRemoteStrategy} from "contracts/strategies/crosschain/CrossChainRemoteStrategy.sol";
import {AbstractCCTPIntegrator} from "contracts/strategies/crosschain/AbstractCCTPIntegrator.sol";
import {CrossChainStrategyHelper} from "contracts/strategies/crosschain/CrossChainStrategyHelper.sol";
import {CCTPMessageTransmitterMock} from "contracts/mocks/crosschain/CCTPMessageTransmitterMock.sol";
import {CCTPTokenMessengerMock} from "contracts/mocks/crosschain/CCTPTokenMessengerMock.sol";
import {InitializableAbstractStrategy} from "contracts/utils/InitializableAbstractStrategy.sol";

contract Unit_Concrete_CrossChainRemoteStrategy_DepositFailure_Test is Base {
    //////////////////////////////////////////////////////
    /// --- DEPOSIT FAILURE (catch blocks)
    //////////////////////////////////////////////////////

    bytes32 internal constant GOVERNOR_SLOT = 0x7bea13895fa79d2831e0a9e28edede30099005a50d652d8957cf8a607ee6ca4a;

    CCTPMessageTransmitterMock internal cctpMessageTransmitterMock;
    CCTPTokenMessengerMock internal cctpTokenMessengerMock;
    MockERC20 internal mockUsdc;
    MockERC20 internal peerUsdc;
    MockFailableERC4626Vault internal failableVault;
    CrossChainRemoteStrategy internal strategy;
    address internal peerStrategy;

    function setUp() public virtual override {
        super.setUp();
        vm.warp(7 days);

        mockUsdc = new MockERC20("USD Coin", "USDC", 6);
        peerUsdc = new MockERC20("USD Coin", "USDC", 6);
        usdc = IERC20(address(mockUsdc));

        failableVault = new MockFailableERC4626Vault(address(mockUsdc));

        cctpMessageTransmitterMock = new CCTPMessageTransmitterMock(address(mockUsdc));
        cctpTokenMessengerMock = new CCTPTokenMessengerMock(address(mockUsdc), address(cctpMessageTransmitterMock));
        peerStrategy = makeAddr("MasterStrategy");

        strategy = new CrossChainRemoteStrategy(
            InitializableAbstractStrategy.BaseStrategyConfig({
                platformAddress: address(failableVault), vaultAddress: address(0)
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

        vm.store(address(strategy), GOVERNOR_SLOT, bytes32(uint256(uint160(governor))));

        vm.prank(governor);
        strategy.initialize(strategist, address(cctpMessageTransmitterMock), 2000, 0);
    }

    function test_deposit_emitsDepositUnderlyingFailed_onStringRevert() public {
        uint256 amount = 100e6;
        mockUsdc.mint(address(strategy), amount);

        // Enable deposit failure with string reason
        failableVault.setDepositFail(true);

        vm.expectEmit(false, false, false, false);
        emit CrossChainRemoteStrategy.DepositUnderlyingFailed("");

        vm.prank(governor);
        strategy.deposit(address(mockUsdc), amount);

        // USDC should still be on the strategy (not deposited)
        assertEq(mockUsdc.balanceOf(address(strategy)), amount);
    }

    function test_deposit_emitsDepositUnderlyingFailed_onLowLevelRevert() public {
        uint256 amount = 100e6;
        mockUsdc.mint(address(strategy), amount);

        // Enable low-level revert
        failableVault.setDepositFail(true);
        failableVault.setRevertLowLevel(true);

        vm.expectEmit(false, false, false, false);
        emit CrossChainRemoteStrategy.DepositUnderlyingFailed("");

        vm.prank(governor);
        strategy.deposit(address(mockUsdc), amount);

        assertEq(mockUsdc.balanceOf(address(strategy)), amount);
    }

    function test_withdraw_emitsWithdrawUnderlyingFailed_onStringRevert() public {
        // First deposit successfully
        uint256 amount = 1000e6;
        mockUsdc.mint(address(strategy), amount);
        vm.prank(governor);
        strategy.deposit(address(mockUsdc), amount);

        // Now enable withdraw failure
        failableVault.setWithdrawFail(true);

        vm.expectEmit(false, false, false, false);
        emit CrossChainRemoteStrategy.WithdrawUnderlyingFailed("");

        vm.prank(governor);
        strategy.withdraw(address(strategy), address(mockUsdc), 500e6);
    }

    function test_withdraw_emitsWithdrawUnderlyingFailed_onLowLevelRevert() public {
        uint256 amount = 1000e6;
        mockUsdc.mint(address(strategy), amount);
        vm.prank(governor);
        strategy.deposit(address(mockUsdc), amount);

        failableVault.setWithdrawFail(true);
        failableVault.setRevertLowLevel(true);

        vm.expectEmit(false, false, false, false);
        emit CrossChainRemoteStrategy.WithdrawUnderlyingFailed("");

        vm.prank(governor);
        strategy.withdraw(address(strategy), address(mockUsdc), 500e6);
    }
}

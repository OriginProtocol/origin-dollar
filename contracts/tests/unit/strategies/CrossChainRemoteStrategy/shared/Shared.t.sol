// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Base} from "tests/Base.t.sol";

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {MockERC20} from "@solmate/test/utils/mocks/MockERC20.sol";
import {MockERC4626Vault} from "contracts/mocks/MockERC4626Vault.sol";
import {CrossChainRemoteStrategy} from "contracts/strategies/crosschain/CrossChainRemoteStrategy.sol";
import {AbstractCCTPIntegrator} from "contracts/strategies/crosschain/AbstractCCTPIntegrator.sol";
import {CrossChainStrategyHelper} from "contracts/strategies/crosschain/CrossChainStrategyHelper.sol";
import {CCTPMessageTransmitterMock} from "contracts/mocks/crosschain/CCTPMessageTransmitterMock.sol";
import {CCTPTokenMessengerMock} from "contracts/mocks/crosschain/CCTPTokenMessengerMock.sol";
import {InitializableAbstractStrategy} from "contracts/utils/InitializableAbstractStrategy.sol";

abstract contract Unit_CrossChainRemoteStrategy_Shared_Test is Base {
    //////////////////////////////////////////////////////
    /// --- CONSTANTS
    //////////////////////////////////////////////////////

    bytes32 internal constant GOVERNOR_SLOT = 0x7bea13895fa79d2831e0a9e28edede30099005a50d652d8957cf8a607ee6ca4a;

    //////////////////////////////////////////////////////
    /// --- CONTRACTS
    //////////////////////////////////////////////////////

    MockERC20 internal mockUsdc;
    MockERC20 internal peerUsdc;
    address internal peerStrategy;
    address internal operatorAddr;

    //////////////////////////////////////////////////////
    /// --- SETUP
    //////////////////////////////////////////////////////

    function setUp() public virtual override {
        super.setUp();
        vm.warp(7 days);

        _deployContracts();
        _labelContracts();
    }

    function _deployContracts() internal {
        // Deploy mock USDC tokens
        mockUsdc = new MockERC20("USD Coin", "USDC", 6);
        peerUsdc = new MockERC20("USD Coin", "USDC", 6);
        usdc = IERC20(address(mockUsdc));

        // Deploy mock ERC4626 vault
        mockERC4626Vault = new MockERC4626Vault(address(mockUsdc));

        // Deploy CCTP mocks
        cctpMessageTransmitterMock = new CCTPMessageTransmitterMock(address(mockUsdc));
        cctpTokenMessengerMock = new CCTPTokenMessengerMock(address(mockUsdc), address(cctpMessageTransmitterMock));

        peerStrategy = makeAddr("MasterStrategy");
        // Use transmitter mock as operator so processFront() can call relay()
        operatorAddr = address(cctpMessageTransmitterMock);

        // Deploy CrossChainRemoteStrategy
        crossChainRemoteStrategy = new CrossChainRemoteStrategy(
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

        // Set governor via slot
        vm.store(address(crossChainRemoteStrategy), GOVERNOR_SLOT, bytes32(uint256(uint160(governor))));

        // Initialize
        vm.prank(governor);
        crossChainRemoteStrategy.initialize(strategist, operatorAddr, 2000, 0);
    }

    function _labelContracts() internal {
        vm.label(address(crossChainRemoteStrategy), "CrossChainRemoteStrategy");
        vm.label(address(mockUsdc), "MockUSDC");
        vm.label(address(peerUsdc), "PeerUSDC");
        vm.label(address(mockERC4626Vault), "MockERC4626Vault");
        vm.label(address(cctpTokenMessengerMock), "CCTPTokenMessenger");
        vm.label(address(cctpMessageTransmitterMock), "CCTPMessageTransmitter");
        vm.label(peerStrategy, "PeerStrategy");
    }

    //////////////////////////////////////////////////////
    /// --- HELPERS
    //////////////////////////////////////////////////////

    /// @dev Mint mock USDC to an address
    function _mintUsdc(address to, uint256 amount) internal {
        mockUsdc.mint(to, amount);
    }

    /// @dev Deposit USDC into the strategy as governor
    function _depositAsGovernor(uint256 amount) internal {
        _mintUsdc(address(crossChainRemoteStrategy), amount);
        vm.prank(governor);
        crossChainRemoteStrategy.deposit(address(mockUsdc), amount);
    }

    /// @dev Simulate an incoming deposit from the master strategy via CCTP token transfer
    function _simulateIncomingDeposit(uint64 nonce, uint256 amount) internal {
        // Mint USDC to the transmitter mock (simulating bridged tokens)
        _mintUsdc(address(cctpMessageTransmitterMock), amount);

        // Build the deposit payload (hook data that will be passed to _onTokenReceived)
        bytes memory depositPayload = CrossChainStrategyHelper.encodeDepositMessage(nonce, amount);

        // Build a properly structured message for the transmitter mock
        // The transmitter processes this by:
        // 1. Transferring USDC to recipient
        // 2. Calling relay() which calls receiveMessage() which calls handleReceiveFinalizedMessage
        // We simulate this by queuing a token transfer message
        // Prank as token messenger so relay() sees sender == cctpTokenMessenger (isBurnMessageV1)
        vm.prank(address(cctpTokenMessengerMock));
        cctpMessageTransmitterMock.sendTokenTransferMessage(
            6, // destinationDomain (remote chain, so mock sets sourceDomain = 0 = Ethereum = peerDomainID)
            bytes32(uint256(uint160(address(crossChainRemoteStrategy)))),
            bytes32(uint256(uint160(address(crossChainRemoteStrategy)))),
            2000, // minFinalityThreshold
            amount,
            _buildBurnMessageBody(amount, depositPayload)
        );
    }

    /// @dev Send a withdraw message to the remote strategy via CCTP
    function _simulateIncomingWithdraw(uint64 nonce, uint256 amount) internal {
        bytes memory withdrawPayload = CrossChainStrategyHelper.encodeWithdrawMessage(nonce, amount);

        // Prank as peerStrategy so relay() sees sender == peerStrategy in the header
        vm.prank(peerStrategy);
        // Queue a non-token message (withdraw is message-only, no USDC attached)
        cctpMessageTransmitterMock.sendMessage(
            6, // destinationDomain (remote chain, so mock sets sourceDomain = 0 = Ethereum = peerDomainID)
            bytes32(uint256(uint160(address(crossChainRemoteStrategy)))),
            bytes32(uint256(uint160(address(crossChainRemoteStrategy)))),
            2000,
            withdrawPayload
        );
    }

    /// @dev Build a mock burn message body for token transfers
    function _buildBurnMessageBody(uint256 amount, bytes memory hookData) internal view returns (bytes memory) {
        bytes32 burnTokenBytes32 = bytes32(uint256(uint160(address(peerUsdc))));
        bytes32 recipientBytes32 = bytes32(uint256(uint160(address(crossChainRemoteStrategy))));
        bytes32 messageSenderBytes32 = bytes32(uint256(uint160(peerStrategy)));
        bytes32 expirationBlock = bytes32(0);
        uint256 maxFee = 0;
        uint256 feeExecuted = 0;

        return abi.encodePacked(
            uint32(1), // version
            burnTokenBytes32, // burnToken
            recipientBytes32, // mintRecipient
            amount, // amount
            messageSenderBytes32, // messageSender
            maxFee, // maxFee
            feeExecuted, // feeExecuted
            expirationBlock, // expirationBlock
            hookData // hookData
        );
    }

    /// @dev Send a balance check message directly to the remote strategy
    function _sendWithdrawMessage(uint64 nonce, uint256 amount) internal {
        bytes memory msg_ = CrossChainStrategyHelper.encodeWithdrawMessage(nonce, amount);

        vm.prank(address(cctpMessageTransmitterMock));
        crossChainRemoteStrategy.handleReceiveFinalizedMessage(
            0, // peerDomainID (Ethereum)
            bytes32(uint256(uint160(peerStrategy))),
            2000,
            msg_
        );
    }
}

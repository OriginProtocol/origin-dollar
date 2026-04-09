// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {Base} from "tests/Base.t.sol";

// --- Test utilities
import {Proxies, Strategies, Tokens, Vaults} from "tests/utils/Artifacts.sol";

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {MockERC20} from "@solmate/test/utils/mocks/MockERC20.sol";
import {IVault} from "contracts/interfaces/IVault.sol";
import {IProxy} from "contracts/interfaces/IProxy.sol";
import {IOToken} from "contracts/interfaces/IOToken.sol";
import {ICrossChainMasterStrategy} from "contracts/interfaces/strategies/ICrossChainMasterStrategy.sol";
import {CrossChainStrategyHelper} from "contracts/strategies/crosschain/CrossChainStrategyHelper.sol";
import {CCTPMessageTransmitterMock} from "contracts/mocks/crosschain/CCTPMessageTransmitterMock.sol";
import {CCTPTokenMessengerMock} from "contracts/mocks/crosschain/CCTPTokenMessengerMock.sol";

abstract contract Unit_CrossChainMasterStrategy_Shared_Test is Base {
    //////////////////////////////////////////////////////
    /// --- CONTRACTS & PROXIES
    //////////////////////////////////////////////////////

    IOToken internal ousd;
    IVault internal ousdVault;
    IProxy internal ousdProxy;
    IProxy internal ousdVaultProxy;
    ICrossChainMasterStrategy internal crossChainMasterStrategy;
    CCTPMessageTransmitterMock internal cctpMessageTransmitterMock;
    CCTPTokenMessengerMock internal cctpTokenMessengerMock;

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

        // Deploy OUSD + OUSDVault through proxies
        vm.startPrank(deployer);

        IOToken ousdImpl = IOToken(vm.deployCode(Tokens.OUSD));
        address ousdVaultImpl = vm.deployCode(Vaults.OUSD, abi.encode(address(mockUsdc)));

        ousdProxy = IProxy(vm.deployCode(Proxies.IG_PROXY));
        ousdVaultProxy = IProxy(vm.deployCode(Proxies.IG_PROXY));

        ousdProxy.initialize(
            address(ousdImpl),
            governor,
            abi.encodeWithSignature("initialize(address,uint256)", address(ousdVaultProxy), 1e27)
        );

        ousdVaultProxy.initialize(
            address(ousdVaultImpl), governor, abi.encodeWithSignature("initialize(address)", address(ousdProxy))
        );

        vm.stopPrank();

        ousd = IOToken(address(ousdProxy));
        ousdVault = IVault(address(ousdVaultProxy));

        // Configure vault
        vm.startPrank(governor);
        ousdVault.unpauseCapital();
        ousdVault.setStrategistAddr(strategist);
        ousdVault.setMaxSupplyDiff(5e16);
        ousdVault.setDripDuration(0);
        ousdVault.setRebaseRateMax(200e18);
        vm.stopPrank();

        // Deploy CCTP mocks
        cctpMessageTransmitterMock = new CCTPMessageTransmitterMock(address(mockUsdc));
        cctpTokenMessengerMock = new CCTPTokenMessengerMock(address(mockUsdc), address(cctpMessageTransmitterMock));

        peerStrategy = makeAddr("RemoteStrategy");
        // Use transmitter mock as operator so processFront() can call relay()
        operatorAddr = address(cctpMessageTransmitterMock);

        // Deploy CrossChainMasterStrategy
        crossChainMasterStrategy = ICrossChainMasterStrategy(
            vm.deployCode(
                Strategies.CROSS_CHAIN_MASTER_STRATEGY,
                abi.encode(
                    address(0), // platformAddress
                    address(ousdVault), // vaultAddress
                    address(cctpTokenMessengerMock), // cctpTokenMessenger
                    address(cctpMessageTransmitterMock), // cctpMessageTransmitter
                    uint32(6), // peerDomainID
                    peerStrategy, // peerStrategy
                    address(mockUsdc), // usdcToken
                    address(peerUsdc) // peerUsdcToken
                )
            )
        );

        // Set governor via slot
        vm.store(address(crossChainMasterStrategy), GOVERNOR_SLOT, bytes32(uint256(uint160(governor))));

        // Initialize
        vm.prank(governor);
        crossChainMasterStrategy.initialize(operatorAddr, 2000, 0);

        // Approve strategy in vault
        vm.prank(governor);
        ousdVault.approveStrategy(address(crossChainMasterStrategy));
    }

    function _labelContracts() internal {
        vm.label(address(crossChainMasterStrategy), "CrossChainMasterStrategy");
        vm.label(address(mockUsdc), "MockUSDC");
        vm.label(address(peerUsdc), "PeerUSDC");
        vm.label(address(cctpTokenMessengerMock), "CCTPTokenMessenger");
        vm.label(address(cctpMessageTransmitterMock), "CCTPMessageTransmitter");
        vm.label(address(ousdVault), "OUSDVault");
        vm.label(peerStrategy, "PeerStrategy");
    }

    //////////////////////////////////////////////////////
    /// --- HELPERS
    //////////////////////////////////////////////////////

    /// @dev Mint mock USDC to an address
    function _mintUsdc(address to, uint256 amount) internal {
        mockUsdc.mint(to, amount);
    }

    /// @dev Mint USDC to strategy and deposit as vault
    function _depositAsVault(uint256 amount) internal {
        _mintUsdc(address(crossChainMasterStrategy), amount);
        vm.prank(address(ousdVault));
        crossChainMasterStrategy.deposit(address(mockUsdc), amount);
    }

    /// @dev Complete a full deposit flow: deposit + process balance check confirmation
    function _completeDepositFlow(uint256 amount) internal {
        _depositAsVault(amount);

        // Process the token transfer message on the "remote" side
        // Since there's no real remote strategy, we simulate the balance check response
        // by directly calling handleReceiveFinalizedMessage with a balance check payload
        uint64 nonce = crossChainMasterStrategy.lastTransferNonce();
        bytes memory balanceCheckMsg =
            CrossChainStrategyHelper.encodeBalanceCheckMessage(nonce, amount, true, block.timestamp);

        vm.prank(address(cctpMessageTransmitterMock));
        crossChainMasterStrategy.handleReceiveFinalizedMessage(
            6, // peerDomainID
            bytes32(uint256(uint160(peerStrategy))),
            2000,
            balanceCheckMsg
        );
    }

    /// @dev Send a balance check message to the master strategy
    function _sendBalanceCheck(uint64 nonce, uint256 balance, bool transferConfirmation, uint256 timestamp) internal {
        bytes memory msg_ =
            CrossChainStrategyHelper.encodeBalanceCheckMessage(nonce, balance, transferConfirmation, timestamp);

        vm.prank(address(cctpMessageTransmitterMock));
        crossChainMasterStrategy.handleReceiveFinalizedMessage(6, bytes32(uint256(uint160(peerStrategy))), 2000, msg_);
    }
}

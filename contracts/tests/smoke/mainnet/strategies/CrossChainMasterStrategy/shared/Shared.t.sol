// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {BaseSmoke} from "tests/smoke/BaseSmoke.t.sol";
import {Mainnet, CrossChain} from "tests/utils/Addresses.sol";

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {ICrossChainMasterStrategy} from "contracts/interfaces/strategies/ICrossChainMasterStrategy.sol";

abstract contract Smoke_CrossChainMasterStrategy_Shared_Test is BaseSmoke {
    //////////////////////////////////////////////////////
    /// --- CONTRACTS
    //////////////////////////////////////////////////////

    ICrossChainMasterStrategy internal crossChainMasterStrategy;

    //////////////////////////////////////////////////////
    /// --- CONSTANTS
    //////////////////////////////////////////////////////

    uint256 internal constant REMOTE_STRATEGY_BALANCE_SLOT = 207;
    uint32 internal constant ORIGIN_MESSAGE_VERSION = 1010;
    uint32 internal constant BALANCE_CHECK_MESSAGE = 3;

    //////////////////////////////////////////////////////
    /// --- ADDRESSES
    //////////////////////////////////////////////////////

    address internal relayer;
    address internal vaultAddr;

    //////////////////////////////////////////////////////
    /// --- SETUP
    //////////////////////////////////////////////////////

    function setUp() public virtual override {
        super.setUp();

        _createAndSelectForkMainnet();
        _igniteDeployManager();

        require(address(resolver).code.length > 0, "Resolver not initialized on fork");
        crossChainMasterStrategy = ICrossChainMasterStrategy(resolver.resolve("CROSS_CHAIN_MASTER_STRATEGY"));
        vm.label(address(crossChainMasterStrategy), "CrossChainMasterStrategy");

        usdc = IERC20(Mainnet.USDC);
        vm.label(Mainnet.USDC, "USDC");

        // Read state from deployed contract
        relayer = crossChainMasterStrategy.operator();
        vaultAddr = crossChainMasterStrategy.vaultAddress();
        vm.label(relayer, "Relayer");
        vm.label(vaultAddr, "Vault");

        // Fund test user with USDC
        deal(Mainnet.USDC, matt, 1_000_000e6);
    }

    //////////////////////////////////////////////////////
    /// --- HELPERS
    //////////////////////////////////////////////////////

    /// @dev Set the remote strategy balance via storage slot 207
    function _setRemoteStrategyBalance(uint256 balance) internal {
        vm.store(address(crossChainMasterStrategy), bytes32(uint256(REMOTE_STRATEGY_BALANCE_SLOT)), bytes32(balance));
    }

    /// @dev Skip the test if the on-chain strategy has a pending transfer
    function _skipIfTransferPending() internal {
        vm.skip(crossChainMasterStrategy.isTransferPending());
    }

    /// @dev Relay a balance check message by calling handleReceiveFinalizedMessage directly,
    ///      pranking as the real MessageTransmitter (bypasses attestation).
    function _relayBalanceCheck(bytes memory balancePayload) internal {
        vm.prank(CrossChain.CCTPMessageTransmitterV2);
        crossChainMasterStrategy.handleReceiveFinalizedMessage(
            6, // sourceDomain (Base)
            bytes32(uint256(uint160(address(crossChainMasterStrategy)))), // sender
            2000, // finalityThresholdExecuted
            balancePayload
        );
    }

    /// @dev Mock receiveMessage on the real MessageTransmitter to bypass attestation verification
    function _mockReceiveMessage() internal {
        vm.mockCall(
            CrossChain.CCTPMessageTransmitterV2,
            abi.encodeWithSignature("receiveMessage(bytes,bytes)"),
            abi.encode(true)
        );
    }

    /// @dev Encode a CCTP message matching the byte offsets expected by the strategy.
    function _encodeCCTPMessage(uint32 sourceDomain, address sender, address recipient, bytes memory messageBody)
        internal
        pure
        returns (bytes memory)
    {
        return abi.encodePacked(
            uint32(1), // version (0..3)
            sourceDomain, // source domain (4..7)
            uint32(0), // destination domain (8..11)
            uint256(0), // nonce (12..43)
            bytes32(uint256(uint160(sender))), // sender (44..75)
            bytes32(uint256(uint160(recipient))), // recipient (76..107)
            bytes32(0), // destination caller (108..139)
            uint32(0), // min finality threshold (140..143)
            uint32(0), // padding (144..147)
            messageBody // body (148+)
        );
    }

    /// @dev Encode the balance-check payload used by the CrossChain smoke tests.
    function _encodeBalanceCheckMessage(uint64 nonce, uint256 balance, bool transferConfirmation, uint256 timestamp)
        internal
        pure
        returns (bytes memory)
    {
        return abi.encodePacked(
            ORIGIN_MESSAGE_VERSION, BALANCE_CHECK_MESSAGE, abi.encode(nonce, balance, transferConfirmation, timestamp)
        );
    }

    /// @dev Encode a burn message body matching AbstractCCTPIntegrator V2 offsets
    function _encodeBurnMessageBody(
        address sender_,
        address recipient_,
        address burnToken_,
        uint256 amount_,
        bytes memory hookData_
    ) internal pure returns (bytes memory) {
        return abi.encodePacked(
            uint32(1), // version (0..3)
            bytes32(uint256(uint160(burnToken_))), // burnToken (4..35)
            bytes32(uint256(uint160(recipient_))), // recipient (36..67)
            amount_, // amount (68..99)
            bytes32(uint256(uint160(sender_))), // sender (100..131)
            uint256(0), // maxFee (132..163)
            uint256(0), // feeExecuted (164..195)
            bytes32(0), // expiration (196..227)
            hookData_ // hookData (228+)
        );
    }
}

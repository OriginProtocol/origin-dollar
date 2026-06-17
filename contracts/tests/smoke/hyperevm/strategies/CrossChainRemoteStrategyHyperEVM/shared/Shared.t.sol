// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {BaseSmoke} from "tests/smoke/BaseSmoke.t.sol";

// --- Test utilities
import {HyperEVM, CrossChain} from "tests/utils/Addresses.sol";

// --- External libraries
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

// --- Project imports
import {ICCTPMessageTransmitterMock2} from "contracts/interfaces/cctp/ICCTPMessageTransmitterMock2.sol";
import {ICrossChainRemoteStrategy} from "contracts/interfaces/strategies/ICrossChainRemoteStrategy.sol";

abstract contract Smoke_CrossChainRemoteStrategyHyperEVM_Shared_Test is BaseSmoke {
    uint32 internal constant ORIGIN_MESSAGE_VERSION = 1010;
    uint32 internal constant DEPOSIT_MESSAGE = 1;
    uint32 internal constant WITHDRAW_MESSAGE = 2;
    uint32 internal constant BALANCE_CHECK_MESSAGE = 3;

    ICrossChainRemoteStrategy internal crossChainRemoteStrategy;

    //////////////////////////////////////////////////////
    /// --- ADDRESSES
    //////////////////////////////////////////////////////

    address internal relayer;
    address internal strategistAddr;
    address internal rafael;

    //////////////////////////////////////////////////////
    /// --- SETUP
    //////////////////////////////////////////////////////

    function setUp() public virtual override {
        super.setUp();
        _createAndSelectForkHyperEVM();
        _igniteDeployManager();
        _fetchContracts();
        _resolveActors();
        _labelContracts();
    }

    function _fetchContracts() internal virtual {
        require(address(resolver).code.length > 0, "Resolver not initialized on fork");
        crossChainRemoteStrategy = ICrossChainRemoteStrategy(resolver.resolve("CROSS_CHAIN_REMOTE_STRATEGY"));
        usdc = IERC20(HyperEVM.USDC);
    }

    function _resolveActors() internal virtual {
        relayer = crossChainRemoteStrategy.operator();
        strategistAddr = crossChainRemoteStrategy.strategistAddr();
        rafael = makeAddr("Rafael");

        deal(HyperEVM.USDC, matt, 1_000_000e6);
        deal(HyperEVM.USDC, rafael, 1_000_000e6);
    }

    function _labelContracts() internal virtual {
        vm.label(address(crossChainRemoteStrategy), "CrossChainRemoteStrategy");
        vm.label(HyperEVM.USDC, "USDC");
        vm.label(relayer, "Relayer");
        vm.label(strategistAddr, "Strategist");
    }

    //////////////////////////////////////////////////////
    /// --- HELPERS
    //////////////////////////////////////////////////////

    /// @dev Replace the real MessageTransmitter with a mock that routes messages locally
    function _replaceMessageTransmitter() internal returns (ICCTPMessageTransmitterMock2) {
        address temp = vm.deployCode(
            "contracts/mocks/crosschain/CCTPMessageTransmitterMock2.sol:CCTPMessageTransmitterMock2",
            abi.encode(HyperEVM.USDC, 0)
        );
        vm.etch(CrossChain.CCTPMessageTransmitterV2, temp.code);

        ICCTPMessageTransmitterMock2 mock = ICCTPMessageTransmitterMock2(CrossChain.CCTPMessageTransmitterV2);
        mock.setCCTPTokenMessenger(CrossChain.CCTPTokenMessengerV2);

        return mock;
    }

    /// @dev Replace the real TokenMessenger with a mock that simulates burns locally
    function _replaceTokenMessenger() internal {
        address temp = vm.deployCode(
            "contracts/mocks/crosschain/CCTPTokenMessengerMock.sol:CCTPTokenMessengerMock",
            abi.encode(HyperEVM.USDC, CrossChain.CCTPMessageTransmitterV2)
        );
        vm.etch(CrossChain.CCTPTokenMessengerV2, temp.code);

        // vm.etch only copies code, not storage. Set required storage slots:
        // slot 0 = usdc, slot 1 = cctpMessageTransmitterMock
        vm.store(CrossChain.CCTPTokenMessengerV2, bytes32(uint256(0)), bytes32(uint256(uint160(HyperEVM.USDC))));
        vm.store(
            CrossChain.CCTPTokenMessengerV2,
            bytes32(uint256(1)),
            bytes32(uint256(uint160(CrossChain.CCTPMessageTransmitterV2)))
        );
    }

    /// @dev Encode a CCTP message matching the byte offsets expected by the strategy relay path.
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

    function _encodeDepositMessage(uint64 nonce, uint256 depositAmount) internal pure returns (bytes memory) {
        return abi.encodePacked(ORIGIN_MESSAGE_VERSION, DEPOSIT_MESSAGE, abi.encode(nonce, depositAmount));
    }

    function _encodeWithdrawMessage(uint64 nonce, uint256 withdrawAmount) internal pure returns (bytes memory) {
        return abi.encodePacked(ORIGIN_MESSAGE_VERSION, WITHDRAW_MESSAGE, abi.encode(nonce, withdrawAmount));
    }

    function _decodeBalanceCheckMessage(bytes memory message)
        internal
        pure
        returns (uint64 nonce, uint256 currentBalance, bool transferConfirmation, uint256 messageTimestamp)
    {
        uint32 version;
        uint32 messageType;
        assembly {
            let word := mload(add(message, 32))
            version := shr(224, word)
            messageType := and(shr(192, word), 0xffffffff)
        }
        require(version == ORIGIN_MESSAGE_VERSION, "Invalid Origin Message Version");
        require(messageType == BALANCE_CHECK_MESSAGE, "Invalid Message type");

        assembly {
            nonce := mload(add(message, 40))
            currentBalance := mload(add(message, 72))
            transferConfirmation := mload(add(message, 104))
            messageTimestamp := mload(add(message, 136))
        }
    }
}

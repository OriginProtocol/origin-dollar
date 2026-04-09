// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {BaseFork} from "tests/fork/BaseFork.t.sol";

// --- Test utilities
import {Base as BaseAddresses, Mainnet, CrossChain} from "tests/utils/Addresses.sol";
import {Mocks} from "tests/utils/artifacts/Mocks.sol";
import {Proxies} from "tests/utils/artifacts/Proxies.sol";
import {Strategies} from "tests/utils/artifacts/Strategies.sol";

// --- External libraries
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

// --- Project imports
import {ICCTPMessageTransmitterMock2} from "contracts/interfaces/cctp/ICCTPMessageTransmitterMock2.sol";
import {ICrossChainMasterStrategy} from "contracts/interfaces/strategies/ICrossChainMasterStrategy.sol";
import {IProxy} from "contracts/interfaces/IProxy.sol";

struct BaseStrategyConfig {
    address platformAddress;
    address vaultAddress;
}

struct CCTPIntegrationConfig {
    address cctpTokenMessenger;
    address cctpMessageTransmitter;
    uint32 peerDomainID;
    address peerStrategy;
    address usdcToken;
    address peerUsdcToken;
}

abstract contract Fork_CrossChainMasterStrategy_Shared_Test is BaseFork {
    //////////////////////////////////////////////////////
    /// --- CONSTANTS
    //////////////////////////////////////////////////////

    uint256 internal constant REMOTE_STRATEGY_BALANCE_SLOT = 207;

    //////////////////////////////////////////////////////
    /// --- CONTRACTS
    //////////////////////////////////////////////////////

    uint32 internal constant BALANCE_CHECK_MESSAGE = 3;
    uint32 internal constant ORIGIN_MESSAGE_VERSION = 1010;

    ICrossChainMasterStrategy internal crossChainMasterStrategy;
    address internal relayer;
    address internal vaultAddr;

    //////////////////////////////////////////////////////
    /// --- SETUP
    //////////////////////////////////////////////////////

    function setUp() public virtual override {
        super.setUp();

        _createAndSelectForkMainnet();
        usdc = IERC20(Mainnet.USDC);
        _deployFreshContracts();
        _configureContracts();

        // Fund test user with USDC
        deal(Mainnet.USDC, matt, 1_000_000e6);

        _labelContracts();
    }

    function _deployFreshContracts() internal {
        relayer = makeAddr("Relayer");
        vaultAddr = makeAddr("Vault");

        IProxy crossChainStrategyProxy = IProxy(vm.deployCode(Proxies.CROSS_CHAIN_STRATEGY_PROXY, abi.encode(governor)));

        address crossChainStrategyImpl = vm.deployCode(
            Strategies.CROSS_CHAIN_MASTER_STRATEGY,
            abi.encode(
                BaseStrategyConfig({platformAddress: address(0), vaultAddress: vaultAddr}),
                CCTPIntegrationConfig({
                    cctpTokenMessenger: CrossChain.CCTPTokenMessengerV2,
                    cctpMessageTransmitter: CrossChain.CCTPMessageTransmitterV2,
                    peerDomainID: 6,
                    peerStrategy: address(crossChainStrategyProxy),
                    usdcToken: Mainnet.USDC,
                    peerUsdcToken: BaseAddresses.USDC
                })
            )
        );

        vm.prank(governor);
        crossChainStrategyProxy.initialize(
            crossChainStrategyImpl,
            governor,
            abi.encodeWithSignature("initialize(address,uint16,uint16)", relayer, uint16(2000), uint16(0))
        );

        crossChainMasterStrategy = ICrossChainMasterStrategy(address(crossChainStrategyProxy));
    }

    function _configureContracts() internal {}

    function _labelContracts() internal {
        vm.label(address(crossChainMasterStrategy), "CrossChainMasterStrategy");
        vm.label(Mainnet.USDC, "USDC");
        vm.label(relayer, "Relayer");
        vm.label(vaultAddr, "Vault");
    }

    //////////////////////////////////////////////////////
    /// --- HELPERS
    //////////////////////////////////////////////////////

    /// @dev Replace the real MessageTransmitter with a mock that routes messages locally
    function _replaceMessageTransmitter() internal returns (ICCTPMessageTransmitterMock2) {
        address temp = vm.deployCode(Mocks.CCTP_MESSAGE_TRANSMITTER_MOCK_2, abi.encode(Mainnet.USDC, uint32(6)));
        vm.etch(CrossChain.CCTPMessageTransmitterV2, address(temp).code);

        ICCTPMessageTransmitterMock2 mock = ICCTPMessageTransmitterMock2(CrossChain.CCTPMessageTransmitterV2);
        mock.setCCTPTokenMessenger(CrossChain.CCTPTokenMessengerV2);

        return mock;
    }

    /// @dev Set the remote strategy balance via storage slot 207
    function _setRemoteStrategyBalance(uint256 balance) internal {
        vm.store(address(crossChainMasterStrategy), bytes32(uint256(REMOTE_STRATEGY_BALANCE_SLOT)), bytes32(balance));
    }

    function _encodeBalanceCheckMessage(uint64 nonce, uint256 balance, bool transferConfirmation, uint256 timestamp)
        internal
        pure
        returns (bytes memory)
    {
        return abi.encodePacked(
            ORIGIN_MESSAGE_VERSION, BALANCE_CHECK_MESSAGE, abi.encode(nonce, balance, transferConfirmation, timestamp)
        );
    }

    /// @dev Encode a CCTP message matching the byte offsets in CrossChainStrategyHelper.decodeMessageHeader()
    ///      VERSION=0, SOURCE_DOMAIN=4, SENDER=44, RECIPIENT=76, BODY=148
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
    ///      BURN_TOKEN=4, RECIPIENT=36, AMOUNT=68, SENDER=100, MAX_FEE=132, FEE_EXECUTED=164, EXPIRATION=196, HOOK_DATA=228
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

    /// @dev Skip the test if the on-chain strategy has a pending transfer
    function _skipIfTransferPending() internal {
        vm.skip(crossChainMasterStrategy.isTransferPending());
    }
}

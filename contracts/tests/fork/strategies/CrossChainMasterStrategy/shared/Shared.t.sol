// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {BaseFork} from "tests/fork/BaseFork.t.sol";
import {Mainnet, Base as BaseAddresses, CrossChain} from "tests/utils/Addresses.sol";

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {CrossChainMasterStrategy} from "contracts/strategies/crosschain/CrossChainMasterStrategy.sol";
import {CrossChainStrategyHelper} from "contracts/strategies/crosschain/CrossChainStrategyHelper.sol";
import {CCTPMessageTransmitterMock2} from "contracts/mocks/crosschain/CCTPMessageTransmitterMock2.sol";

abstract contract Fork_CrossChainMasterStrategy_Shared_Test is BaseFork {
    //////////////////////////////////////////////////////
    /// --- CONSTANTS
    //////////////////////////////////////////////////////

    uint256 internal constant REMOTE_STRATEGY_BALANCE_SLOT = 207;

    //////////////////////////////////////////////////////
    /// --- CONTRACTS
    //////////////////////////////////////////////////////

    address internal relayer;
    address internal vaultAddr;

    //////////////////////////////////////////////////////
    /// --- SETUP
    //////////////////////////////////////////////////////

    function setUp() public virtual override {
        super.setUp();

        _createAndSelectForkMainnet();

        // Attach to deployed contracts
        crossChainMasterStrategy = CrossChainMasterStrategy(Mainnet.CrossChainMasterStrategy);
        usdc = IERC20(Mainnet.USDC);

        // Read state from deployed contract
        relayer = crossChainMasterStrategy.operator();
        vaultAddr = crossChainMasterStrategy.vaultAddress();

        // Fund test user with USDC
        deal(Mainnet.USDC, matt, 1_000_000e6);

        _labelContracts();
    }

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
    function _replaceMessageTransmitter() internal returns (CCTPMessageTransmitterMock2) {
        CCTPMessageTransmitterMock2 temp = new CCTPMessageTransmitterMock2(Mainnet.USDC);
        vm.etch(CrossChain.CCTPMessageTransmitterV2, address(temp).code);

        CCTPMessageTransmitterMock2 mock = CCTPMessageTransmitterMock2(CrossChain.CCTPMessageTransmitterV2);
        mock.setCCTPTokenMessenger(CrossChain.CCTPTokenMessengerV2);

        return mock;
    }

    /// @dev Set the remote strategy balance via storage slot 207
    function _setRemoteStrategyBalance(uint256 balance) internal {
        vm.store(address(crossChainMasterStrategy), bytes32(uint256(REMOTE_STRATEGY_BALANCE_SLOT)), bytes32(balance));
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

// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {BaseFork} from "tests/fork/BaseFork.t.sol";
import {Mainnet, Base as BaseAddresses, CrossChain} from "tests/utils/Addresses.sol";

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {CrossChainRemoteStrategy} from "contracts/strategies/crosschain/CrossChainRemoteStrategy.sol";
import {CrossChainStrategyHelper} from "contracts/strategies/crosschain/CrossChainStrategyHelper.sol";
import {CCTPMessageTransmitterMock2} from "contracts/mocks/crosschain/CCTPMessageTransmitterMock2.sol";

abstract contract Fork_CrossChainRemoteStrategy_Shared_Test is BaseFork {
    //////////////////////////////////////////////////////
    /// --- CONTRACTS
    //////////////////////////////////////////////////////

    address internal relayer;
    address internal strategistAddr;
    address internal rafael;

    //////////////////////////////////////////////////////
    /// --- SETUP
    //////////////////////////////////////////////////////

    function setUp() public virtual override {
        super.setUp();

        _createAndSelectForkBase();

        // Attach to deployed contracts
        crossChainRemoteStrategy = CrossChainRemoteStrategy(BaseAddresses.CrossChainRemoteStrategy);
        usdc = IERC20(BaseAddresses.USDC);

        // Read state from deployed contract
        relayer = crossChainRemoteStrategy.operator();
        strategistAddr = crossChainRemoteStrategy.strategistAddr();

        // Create additional test user
        rafael = makeAddr("Rafael");

        // Fund test users with USDC
        deal(BaseAddresses.USDC, matt, 1_000_000e6);
        deal(BaseAddresses.USDC, rafael, 1_000_000e6);

        _labelContracts();
    }

    function _labelContracts() internal {
        vm.label(address(crossChainRemoteStrategy), "CrossChainRemoteStrategy");
        vm.label(BaseAddresses.USDC, "USDC");
        vm.label(relayer, "Relayer");
        vm.label(strategistAddr, "Strategist");
    }

    //////////////////////////////////////////////////////
    /// --- HELPERS
    //////////////////////////////////////////////////////

    /// @dev Replace the real MessageTransmitter with a mock that routes messages locally
    function _replaceMessageTransmitter() internal returns (CCTPMessageTransmitterMock2) {
        CCTPMessageTransmitterMock2 temp = new CCTPMessageTransmitterMock2(BaseAddresses.USDC);
        vm.etch(CrossChain.CCTPMessageTransmitterV2, address(temp).code);

        CCTPMessageTransmitterMock2 mock = CCTPMessageTransmitterMock2(CrossChain.CCTPMessageTransmitterV2);
        mock.setCCTPTokenMessenger(CrossChain.CCTPTokenMessengerV2);

        return mock;
    }

    /// @dev Encode a CCTP message matching the byte offsets in CrossChainStrategyHelper.decodeMessageHeader()
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
            uint32(1), // version
            bytes32(uint256(uint160(burnToken_))),
            bytes32(uint256(uint160(recipient_))),
            amount_,
            bytes32(uint256(uint160(sender_))),
            uint256(0), // maxFee
            uint256(0), // feeExecuted
            bytes32(0), // expiration
            hookData_
        );
    }
}

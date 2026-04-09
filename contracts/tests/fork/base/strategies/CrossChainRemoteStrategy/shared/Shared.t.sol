// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {BaseFork} from "tests/fork/BaseFork.t.sol";

// --- Test utilities
import {Mainnet, Base as BaseAddresses, CrossChain} from "tests/utils/Addresses.sol";
import {Mocks, Proxies, Strategies} from "tests/utils/Artifacts.sol";

// --- External libraries
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {IProxy} from "contracts/interfaces/IProxy.sol";
import {ICrossChainRemoteStrategy} from "contracts/interfaces/strategies/ICrossChainRemoteStrategy.sol";
import {CCTPMessageTransmitterMock2} from "contracts/mocks/crosschain/CCTPMessageTransmitterMock2.sol";

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

abstract contract Fork_CrossChainRemoteStrategy_Shared_Test is BaseFork {
    //////////////////////////////////////////////////////
    /// --- CONTRACTS
    //////////////////////////////////////////////////////

    ICrossChainRemoteStrategy internal crossChainRemoteStrategy;
    address internal relayer;
    address internal strategistAddr;
    address internal rafael;

    //////////////////////////////////////////////////////
    /// --- SETUP
    //////////////////////////////////////////////////////

    function setUp() public virtual override {
        super.setUp();

        _createAndSelectForkBase();
        _deployFreshContracts();
        _configureContracts();
        _fundTestAccounts();
        _labelContracts();
    }

    function _deployFreshContracts() internal {
        usdc = IERC20(BaseAddresses.USDC);
        relayer = CrossChain.multichainStrategist;
        strategistAddr = CrossChain.multichainStrategist;

        IProxy crossChainRemoteStrategyProxy =
            IProxy(vm.deployCode(Proxies.CROSS_CHAIN_STRATEGY_PROXY, abi.encode(governor)));

        address crossChainRemoteStrategyImpl = vm.deployCode(
            Strategies.CROSS_CHAIN_REMOTE_STRATEGY,
            abi.encode(
                BaseStrategyConfig({platformAddress: BaseAddresses.MorphoOusdV2Vault, vaultAddress: address(0)}),
                CCTPIntegrationConfig({
                    cctpTokenMessenger: CrossChain.CCTPTokenMessengerV2,
                    cctpMessageTransmitter: CrossChain.CCTPMessageTransmitterV2,
                    peerDomainID: 0,
                    peerStrategy: address(crossChainRemoteStrategyProxy),
                    usdcToken: BaseAddresses.USDC,
                    peerUsdcToken: Mainnet.USDC
                })
            )
        );

        vm.prank(governor);
        crossChainRemoteStrategyProxy.initialize(
            crossChainRemoteStrategyImpl,
            governor,
            abi.encodeWithSignature(
                "initialize(address,address,uint16,uint16)", strategistAddr, relayer, uint16(2000), uint16(0)
            )
        );

        crossChainRemoteStrategy = ICrossChainRemoteStrategy(address(crossChainRemoteStrategyProxy));
    }

    function _configureContracts() internal {
        vm.prank(governor);
        crossChainRemoteStrategy.safeApproveAllTokens();
    }

    function _fundTestAccounts() internal {
        rafael = makeAddr("Rafael");
        deal(BaseAddresses.USDC, matt, 1_000_000e6);
        deal(BaseAddresses.USDC, rafael, 1_000_000e6);
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
        CCTPMessageTransmitterMock2 temp = new CCTPMessageTransmitterMock2(BaseAddresses.USDC, 0);
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

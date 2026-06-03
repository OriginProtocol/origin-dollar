// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import { IRouterClient } from "@chainlink/contracts-ccip/src/v0.8/ccip/interfaces/IRouterClient.sol";
import { Client } from "@chainlink/contracts-ccip/src/v0.8/ccip/libraries/Client.sol";

import { AbstractOutboundAdapter } from "./AbstractOutboundAdapter.sol";

interface IL1StandardBridge {
    /// @notice OP Stack canonical bridge ERC20 deposit. Tokens arrive at `_to` on the L2.
    function bridgeERC20To(
        address _localToken,
        address _remoteToken,
        address _to,
        uint256 _amount,
        uint32 _minGasLimit,
        bytes calldata _extraData
    ) external;
}

/**
 * @title SuperbridgeCanonicalOutboundAdapter
 * @author Origin Protocol Inc
 *
 * @notice Split-delivery outbound adapter for Ethereum → OP-Stack-L2 token bridging.
 *         Tokens travel via the canonical OP Stack L1StandardBridge (free, but
 *         token-only; no calldata can ride along). The message envelope travels
 *         separately via Chainlink CCIP and lands at the peer SuperbridgeCCIPInboundAdapter
 *         on the L2, which holds it in its pending slot until the canonical-bridge tokens
 *         arrive.
 *
 *         Dedicated per pair — sharing across pairs would be unsafe because the canonical
 *         bridge's ERC20 deposit can't be addressed to anyone but the configured peer
 *         receiver adapter.
 */
contract SuperbridgeCanonicalOutboundAdapter is AbstractOutboundAdapter {
    using SafeERC20 for IERC20;

    IL1StandardBridge public immutable l1StandardBridge;
    IRouterClient public immutable ccipRouter;

    /// @notice L2 token address corresponding to `localToken`. OP Stack canonical bridge
    ///         needs this to mint on the destination chain.
    mapping(address => address) public remoteTokenOf;

    /// @notice Per-sender CCIP message destination gas limit.
    mapping(address => uint256) public destGasLimitFor;

    /// @notice Per-sender canonical bridge minimum gas hint (typically 200k for OP Stack).
    mapping(address => uint32) public canonicalMinGasFor;

    event RemoteTokenMapped(address localToken, address remoteToken);
    event DestGasLimitConfigured(address sender, uint256 destGasLimit);
    event CanonicalMinGasConfigured(address sender, uint32 canonicalMinGas);

    constructor(IL1StandardBridge _l1, IRouterClient _ccip) {
        require(address(_l1) != address(0), "SuperOut: zero L1 bridge");
        require(address(_ccip) != address(0), "SuperOut: zero CCIP");
        l1StandardBridge = _l1;
        ccipRouter = _ccip;
    }

    function mapRemoteToken(address _localToken, address _remoteToken)
        external
        onlyGovernor
    {
        remoteTokenOf[_localToken] = _remoteToken;
        emit RemoteTokenMapped(_localToken, _remoteToken);
    }

    function setDestGasLimit(address _sender, uint256 _gasLimit)
        external
        onlyGovernor
    {
        destGasLimitFor[_sender] = _gasLimit;
        emit DestGasLimitConfigured(_sender, _gasLimit);
    }

    function setCanonicalMinGas(address _sender, uint32 _g)
        external
        onlyGovernor
    {
        canonicalMinGasFor[_sender] = _g;
        emit CanonicalMinGasConfigured(_sender, _g);
    }

    function estimateFee(uint256, bytes calldata message)
        external
        view
        override
        returns (uint256 nativeFee, uint256 tokenFee)
    {
        Client.EVM2AnyMessage memory ccipMessage = Client.EVM2AnyMessage({
            receiver: abi.encode(peerReceiverFor[msg.sender]),
            data: message,
            tokenAmounts: new Client.EVMTokenAmount[](0),
            feeToken: address(0),
            extraArgs: Client._argsToBytes(
                Client.EVMExtraArgsV1({ gasLimit: destGasLimitFor[msg.sender] })
            )
        });
        nativeFee = ccipRouter.getFee(destinationFor[msg.sender], ccipMessage);
        tokenFee = 0;
    }

    function _sendTokensAndMessage(
        address token,
        uint256 amount,
        bytes calldata message,
        uint64 destination,
        address peerReceiver
    ) internal override {
        require(amount > 0, "SuperOut: zero amount");
        address remoteToken = remoteTokenOf[token];
        require(remoteToken != address(0), "SuperOut: remote token unmapped");

        // Leg 1: canonical bridge — pull tokens from the strategy and bridge to the peer
        // receiver on the L2.
        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
        IERC20(token).safeApprove(address(l1StandardBridge), amount);
        l1StandardBridge.bridgeERC20To(
            token,
            remoteToken,
            peerReceiver,
            amount,
            canonicalMinGasFor[msg.sender],
            ""
        );

        // Leg 2: CCIP message-only.
        _sendCCIPMessage(message, destination, peerReceiver);
    }

    function _sendMessage(
        bytes calldata message,
        uint64 destination,
        address peerReceiver
    ) internal override {
        _sendCCIPMessage(message, destination, peerReceiver);
    }

    function _sendCCIPMessage(
        bytes memory message,
        uint64 destination,
        address peerReceiver
    ) internal {
        Client.EVM2AnyMessage memory ccipMessage = Client.EVM2AnyMessage({
            receiver: abi.encode(peerReceiver),
            data: message,
            tokenAmounts: new Client.EVMTokenAmount[](0),
            feeToken: address(0),
            extraArgs: Client._argsToBytes(
                Client.EVMExtraArgsV1({ gasLimit: destGasLimitFor[msg.sender] })
            )
        });
        uint256 fee = ccipRouter.getFee(destination, ccipMessage);
        _consumeFee(fee);
        ccipRouter.ccipSend{ value: fee }(destination, ccipMessage);
    }
}

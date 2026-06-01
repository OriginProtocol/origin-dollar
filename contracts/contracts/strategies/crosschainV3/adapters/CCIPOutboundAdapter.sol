// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import { IRouterClient } from "@chainlink/contracts-ccip/src/v0.8/ccip/interfaces/IRouterClient.sol";
import { Client } from "@chainlink/contracts-ccip/src/v0.8/ccip/libraries/Client.sol";

import { AbstractOutboundAdapter } from "./AbstractOutboundAdapter.sol";

/**
 * @title CCIPOutboundAdapter
 * @author Origin Protocol Inc
 *
 * @notice Atomic outbound adapter over Chainlink CCIP. Carries token + message
 *         (`sendTokensAndMessage`) or message-only (`sendMessage`) to the configured peer
 *         receiver adapter on the destination chain. Pays the bridge fee in native gas.
 */
contract CCIPOutboundAdapter is AbstractOutboundAdapter {
    using SafeERC20 for IERC20;

    /// @notice CCIP Router on this chain.
    IRouterClient public immutable ccipRouter;

    /// @notice Per-sender outbound gas limit for the CCIP destination receive callback.
    mapping(address => uint256) public destGasLimitFor;

    event DestGasLimitConfigured(address sender, uint256 destGasLimit);

    constructor(IRouterClient _ccipRouter) {
        require(address(_ccipRouter) != address(0), "CCIPOut: zero router");
        ccipRouter = _ccipRouter;
    }

    function setDestGasLimit(address _sender, uint256 _gasLimit)
        external
        onlyGovernor
    {
        require(authorisedSenders[_sender], "CCIPOut: sender not authorised");
        destGasLimitFor[_sender] = _gasLimit;
        emit DestGasLimitConfigured(_sender, _gasLimit);
    }

    function estimateFee(uint256 amount, bytes calldata message)
        external
        view
        override
        returns (uint256 nativeFee, uint256 tokenFee)
    {
        Client.EVM2AnyMessage memory ccipMessage = _buildMessage(
            address(0),
            amount,
            message,
            peerReceiverFor[msg.sender],
            destGasLimitFor[msg.sender]
        );
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
        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
        IERC20(token).safeApprove(address(ccipRouter), amount);
        Client.EVM2AnyMessage memory ccipMessage = _buildMessage(
            token,
            amount,
            message,
            peerReceiver,
            destGasLimitFor[msg.sender]
        );
        uint256 fee = ccipRouter.getFee(destination, ccipMessage);
        _consumeFee(fee);
        ccipRouter.ccipSend{ value: fee }(destination, ccipMessage);
    }

    function _sendMessage(
        bytes calldata message,
        uint64 destination,
        address peerReceiver
    ) internal override {
        Client.EVM2AnyMessage memory ccipMessage = _buildMessage(
            address(0),
            0,
            message,
            peerReceiver,
            destGasLimitFor[msg.sender]
        );
        uint256 fee = ccipRouter.getFee(destination, ccipMessage);
        _consumeFee(fee);
        ccipRouter.ccipSend{ value: fee }(destination, ccipMessage);
    }

    function _buildMessage(
        address token,
        uint256 amount,
        bytes memory message,
        address peerReceiver,
        uint256 destGasLimit
    ) internal pure returns (Client.EVM2AnyMessage memory) {
        Client.EVMTokenAmount[] memory tokenAmounts;
        if (token != address(0) && amount > 0) {
            tokenAmounts = new Client.EVMTokenAmount[](1);
            tokenAmounts[0] = Client.EVMTokenAmount({
                token: token,
                amount: amount
            });
        } else {
            tokenAmounts = new Client.EVMTokenAmount[](0);
        }
        return
            Client.EVM2AnyMessage({
                receiver: abi.encode(peerReceiver),
                data: message,
                tokenAmounts: tokenAmounts,
                feeToken: address(0), // pay in native
                extraArgs: Client._argsToBytes(
                    Client.EVMExtraArgsV1({ gasLimit: destGasLimit })
                )
            });
    }
}

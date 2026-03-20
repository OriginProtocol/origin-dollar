// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import { IRouterClient } from "@chainlink/contracts-ccip/src/v0.8/ccip/interfaces/IRouterClient.sol";
import { Client } from "@chainlink/contracts-ccip/src/v0.8/ccip/libraries/Client.sol";
// solhint-disable-next-line  max-line-length
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { IERC4626 } from "./../../lib/openzeppelin/interfaces/IERC4626.sol";
import { IOETHZapper } from "./../interfaces/IOETHZapper.sol";

/**
 * @title WOETH CCIP Zapper Contract
 * @notice Helps to directly convert ETH on mainnet into WOETH on L2s.
 * @author Origin Protocol Inc
 */

contract WOETHCCIPZapper {
    /**
     * @dev Event emitted when a zap occurs
     * @param messageId Unique message identifier for each zap
     * @param sender Address initiating the zap
     * @param recipient Recipient address at destination chain
     * @param amount Amount of ETH zapped
     */
    event Zap(
        bytes32 indexed messageId,
        address sender,
        address recipient,
        uint256 amount
    );

    // @dev Thrown when Zap amount is less than fee.
    error AmountLessThanFee();

    /**
     * @dev The destination chain selector
     */
    uint64 public immutable destinationChainSelector;

    /**
     * @dev The WOETH source chain (Mainnet)
     */
    IERC4626 public immutable woethOnSourceChain;

    /**
     * @dev The WOETH destination chain (Arbitrum)
     */
    IERC20 public immutable woethOnDestinationChain;

    /**
     * @dev The OETH zapper contract address
     */
    IOETHZapper public immutable oethZapper;

    /**
     * @dev The CCIP router contract address
     */
    IRouterClient public immutable ccipRouter;

    /**
     * @dev The OETH token contract address
     */
    IERC20 public immutable oeth;

    constructor(
        address _ccipRouter,
        uint64 _destinationChainSelector,
        IERC4626 _woethOnSourceChain,
        IERC20 _woethOnDestinationChain,
        IOETHZapper _oethZapper,
        IERC20 _oeth
    ) {
        ccipRouter = IRouterClient(_ccipRouter);
        destinationChainSelector = _destinationChainSelector;
        woethOnSourceChain = _woethOnSourceChain;
        woethOnDestinationChain = _woethOnDestinationChain;
        oethZapper = _oethZapper;
        oeth = _oeth;

        // Max allowance for Router and WOETH contracts
        _oeth.approve(address(_woethOnSourceChain), type(uint256).max); // for wrapping
        _woethOnSourceChain.approve(address(_ccipRouter), type(uint256).max); // for zapping
    }

    /**
     * @notice Accepts ETH, zaps for OETH, wraps it for WOETH and sends it to the destination chain (arbitrum)
     * @param receiver The address of the EOA on the destination chain
     * @return messageId The ID of the message that was sent
     */
    function zap(address receiver)
        external
        payable
        returns (bytes32 messageId)
    {
        return _zap(receiver, msg.value);
    }

    /**
     * @notice Used to estimate fee for CCIP transaction
     * @param amount The amount of ETH to be zapped
     * @param receiver The address of the EOA on the destination chain
     * @return feeAmount The CCIP tx fee in ETH.
     */

    function getFee(uint256 amount, address receiver)
        public
        view
        returns (uint256 feeAmount)
    {
        Client.EVMTokenAmount[]
            memory tokenAmounts = new Client.EVMTokenAmount[](1);
        Client.EVMTokenAmount memory tokenAmount = Client.EVMTokenAmount({
            token: address(woethOnSourceChain),
            amount: amount
        });
        tokenAmounts[0] = tokenAmount;

        Client.EVM2AnyMessage memory message = Client.EVM2AnyMessage({
            receiver: abi.encode(receiver), // ABI-encoded receiver address
            data: abi.encode(""),
            tokenAmounts: tokenAmounts,
            extraArgs: Client._argsToBytes(
                Client.EVMExtraArgsV1({ gasLimit: 0 })
            ),
            feeToken: address(0)
        });

        feeAmount = ccipRouter.getFee(destinationChainSelector, message);
    }

    /**
     * @dev Deposit ETH and receive WOETH in L2.
     * @dev Note that the WOETH will be sent to the msg.sender at destination chain as well.
     */
    receive() external payable {
        _zap(msg.sender, msg.value);
    }

    function _zap(address receiver, uint256 amount)
        internal
        returns (bytes32 messageId)
    {
        // Estimate fee for zapping.
        uint256 feeAmount = getFee(amount, receiver);
        if (amount < feeAmount) {
            revert AmountLessThanFee();
        }

        // Convert only the msg.value - fees amount to WOETH.
        amount -= feeAmount;

        // 1.) Zap for OETH
        uint256 oethReceived = oethZapper.deposit{ value: amount }();

        // 2.) Wrap the received woeth
        uint256 woethReceived = woethOnSourceChain.deposit(
            oethReceived,
            address(this)
        );

        // 3.) Setup params for CCIP transfer

        Client.EVMTokenAmount[]
            memory tokenAmounts = new Client.EVMTokenAmount[](1);
        Client.EVMTokenAmount memory tokenAmount = Client.EVMTokenAmount({
            token: address(woethOnSourceChain),
            amount: woethReceived
        });
        tokenAmounts[0] = tokenAmount;

        Client.EVM2AnyMessage memory message = Client.EVM2AnyMessage({
            receiver: abi.encode(receiver), // ABI-encoded receiver address
            data: abi.encode(""),
            tokenAmounts: tokenAmounts,
            extraArgs: Client._argsToBytes(
                // See: https://docs.chain.link/ccip/best-practices#setting-gaslimit
                Client.EVMExtraArgsV1({ gasLimit: 0 })
            ),
            feeToken: address(0)
        });

        // ZAP ϟ
        //slither-disable-next-line arbitrary-send-eth
        messageId = ccipRouter.ccipSend{ value: feeAmount }(
            destinationChainSelector,
            message
        );

        // Emit Zap event with message details
        emit Zap(messageId, msg.sender, receiver, amount);

        // Return the message ID
        return messageId;
    }
}

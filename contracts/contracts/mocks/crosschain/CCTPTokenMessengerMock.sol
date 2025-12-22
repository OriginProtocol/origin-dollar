// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import { ICCTPTokenMessenger } from "../../interfaces/cctp/ICCTP.sol";
import { CCTPMessageTransmitterMock } from "./CCTPMessageTransmitterMock.sol";
import { IERC20 } from "../../utils/InitializableAbstractStrategy.sol";

/**
 * @title Mock conctract simulating the functionality of the CCTPTokenMessenger contract
 *        for the porposes of unit testing. 
 * @author Origin Protocol Inc
 */

contract CCTPTokenMessengerMock is ICCTPTokenMessenger{
    IERC20 public usdc;
    CCTPMessageTransmitterMock public cctpMessageTransmitterMock;

    constructor(address _usdc, address _cctpMessageTransmitterMock) {
        usdc = IERC20(_usdc);
        cctpMessageTransmitterMock = CCTPMessageTransmitterMock(_cctpMessageTransmitterMock);
    }

    function depositForBurn(
        uint256 amount,
        uint32 destinationDomain,
        bytes32 mintRecipient,
        address burnToken,
        bytes32 destinationCaller,
        uint256 maxFee,
        uint32 minFinalityThreshold
    ) external override {
        revert("Not implemented");
    }

    /**
     * @dev mocks the depositForBurnWithHook function by sending the USDC to the CCTPMessageTransmitterMock
     *      called by the AbstractCCTPIntegrator contract.
     */
    function depositForBurnWithHook(
        uint256 amount,
        uint32 destinationDomain,
        bytes32 mintRecipient,
        address burnToken,
        bytes32 destinationCaller,
        uint256 maxFee,
        uint32 minFinalityThreshold,
        bytes memory hookData
        ) external override {
        require(burnToken == address(usdc), "Invalid burn token");

        usdc.transferFrom(msg.sender, address(this), maxFee);
        uint256 destinationAmount = amount - maxFee;
        usdc.transferFrom(msg.sender, address(cctpMessageTransmitterMock), destinationAmount);


        bytes memory burnMessage = _encodeBurnMessageV2(
            mintRecipient,
            amount,
            msg.sender,
            maxFee,
            maxFee,
            hookData
        );

        cctpMessageTransmitterMock.sendTokenTransferMessage(
            destinationDomain,
            mintRecipient,
            destinationCaller,
            minFinalityThreshold,
            destinationAmount,
            burnMessage
        );
    }

    function _encodeBurnMessageV2(
        bytes32 mintRecipient,
        uint256 amount,
        address messageSender,
        uint256 maxFee,
        uint256 feeExecuted,
        bytes memory hookData
    ) internal view returns (bytes memory) {
        bytes32 burnTokenBytes32 = bytes32(abi.encodePacked(bytes12(0), bytes20(uint160(address(usdc)))));
        bytes32 messageSenderBytes32 = bytes32(abi.encodePacked(bytes12(0), bytes20(uint160(messageSender))));

        return abi.encodePacked(
            uint32(1),                          // 0-3: version
            burnTokenBytes32,                   // 4-35: burnToken (bytes32 left-padded address)
            mintRecipient,                      // 36-67: mintRecipient (bytes32 left-padded address)
            amount,                             // 68-99: uint256 amount
            messageSenderBytes32,               // 100-131: messageSender (bytes32 left-padded address)
            maxFee,                             // 132-163: uint256 maxFee
            feeExecuted,                        // 164-195: uint256 feeExecuted
            hookData                            // 196+: dynamic hookData
        );
    }

    function getMinFeeAmount(uint256 amount) external view override returns (uint256) {
        return 0;
    }
}

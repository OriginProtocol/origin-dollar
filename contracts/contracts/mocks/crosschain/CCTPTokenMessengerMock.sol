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
        cctpMessageTransmitterMock.sendTokenTransferMessage(
            destinationDomain,
            mintRecipient,
            destinationCaller,
            minFinalityThreshold,
            destinationAmount,
            hookData
        );
    }

    function getMinFeeAmount(uint256 amount) external view override returns (uint256) {
        return 0;
    }
}

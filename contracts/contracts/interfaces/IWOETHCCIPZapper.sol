// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

interface IWOETHCCIPZapper {
    event Zap(
        bytes32 indexed messageId,
        address sender,
        address recipient,
        uint256 amount
    );

    error AmountLessThanFee();

    function zap(address receiver) external payable returns (bytes32 messageId);

    function getFee(uint256 amount, address receiver)
        external
        view
        returns (uint256 feeAmount);
}

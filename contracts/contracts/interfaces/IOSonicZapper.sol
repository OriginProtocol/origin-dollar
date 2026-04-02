// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

interface IOSonicZapper {
    event Zap(address indexed minter, address indexed asset, uint256 amount);

    function OS() external view returns (address);

    function wOS() external view returns (address);

    function vault() external view returns (address);

    function deposit() external payable returns (uint256);

    function depositSForWrappedTokens(uint256 minReceived) external payable returns (uint256);

    function depositWSForWrappedTokens(uint256 wSAmount, uint256 minReceived) external returns (uint256);
}

// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

interface IOETHZapper {
    event Zap(address indexed minter, address indexed asset, uint256 amount);

    function oToken() external view returns (address);

    function wOToken() external view returns (address);

    function vault() external view returns (address);

    function weth() external view returns (address);

    function deposit() external payable returns (uint256);

    function depositETHForWrappedTokens(uint256 minReceived)
        external
        payable
        returns (uint256);

    function depositWETHForWrappedTokens(
        uint256 wethAmount,
        uint256 minReceived
    ) external returns (uint256);
}

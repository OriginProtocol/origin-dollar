// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {IAbstractSafeModule} from "contracts/interfaces/automation/IAbstractSafeModule.sol";

interface IBaseBridgeHelperModule is IAbstractSafeModule {
    function vault() external view returns (address);

    function weth() external view returns (address);

    function oethb() external view returns (address);

    function bridgedWOETH() external view returns (address);

    function bridgedWOETHStrategy() external view returns (address);

    function CCIP_ROUTER() external view returns (address);

    function CCIP_ETHEREUM_CHAIN_SELECTOR() external view returns (uint64);

    function bridgeWOETHToEthereum(uint256 woethAmount) external payable;

    function bridgeWETHToEthereum(uint256 wethAmount) external payable;

    function depositWOETH(uint256 woethAmount, bool requestWithdrawal)
        external
        returns (uint256 requestId, uint256 oethbAmount);

    function claimAndBridgeWETH(uint256 requestId) external payable;

    function claimWithdrawal(uint256 requestId) external returns (uint256 wethAmount);

    function depositWETHAndRedeemWOETH(uint256 wethAmount) external returns (uint256);

    function depositWETHAndBridgeWOETH(uint256 wethAmount) external returns (uint256);
}

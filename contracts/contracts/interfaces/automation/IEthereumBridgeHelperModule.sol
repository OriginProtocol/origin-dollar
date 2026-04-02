// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import { IAbstractSafeModule } from "contracts/interfaces/automation/IAbstractSafeModule.sol";

interface IEthereumBridgeHelperModule is IAbstractSafeModule {
    function vault() external view returns (address);

    function weth() external view returns (address);

    function oeth() external view returns (address);

    function woeth() external view returns (address);

    function CCIP_ROUTER() external view returns (address);

    function CCIP_BASE_CHAIN_SELECTOR() external view returns (uint64);

    function bridgeWOETHToBase(uint256 woethAmount) external payable;

    function bridgeWETHToBase(uint256 wethAmount) external payable;

    function mintAndWrap(uint256 wethAmount, bool useNativeToken)
        external
        returns (uint256);

    function wrapETH(uint256 ethAmount) external payable;

    function mintWrapAndBridgeToBase(uint256 wethAmount, bool useNativeToken)
        external
        payable;

    function unwrapAndRequestWithdrawal(uint256 woethAmount)
        external
        returns (uint256 requestId, uint256 oethAmount);

    function claimAndBridgeToBase(uint256 requestId) external payable;

    function claimWithdrawal(uint256 requestId)
        external
        returns (uint256 wethAmount);
}

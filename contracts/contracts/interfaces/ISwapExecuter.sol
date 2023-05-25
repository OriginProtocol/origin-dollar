pragma solidity ^0.8.0;

interface ISwapExecuter {
    function executeSwap() external returns (uint256 toAssetAmount);
}

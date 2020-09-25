pragma solidity 0.5.11;

import { IUniswapV2Pair } from "../interfaces/uniswap/IUniswapV2Pair.sol";
import { Governable } from "../governance/Governable.sol";

contract RebaseHooks is Governable {
    // Array of Uniswap pairs for OUSD. Used for calling sync() on each.
    address[] public uniswapPairs;

    function setUniswapPairs(address[] calldata _uniswapPairs)
        external
        onlyGovernor
    {
        uniswapPairs = _uniswapPairs;
    }

    function postRebase(bool sync) external {
        if (sync) {
            // Sync Uniswap pairs
            for (uint256 i = 0; i < uniswapPairs.length; i++) {
                IUniswapV2Pair(uniswapPairs[i]).sync();
            }
        }
    }
}

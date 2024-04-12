// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import { Governable } from "../../governance/Governable.sol";
import { IWETH9 } from "../../interfaces/IWETH9.sol";

/**
 * @title Fee Accumulator for Native Staking SSV Strategy
 * @notice This contract is setup to receive fees from processing transactions on the beacon chain
 *         which includes priority fees and any MEV rewards
 * @author Origin Protocol Inc
 */
contract FeeAccumulator is Governable {
    /// @dev ETH is sent to the collector address
    address public immutable COLLECTOR;
    /// @notice WETH token address
    address public immutable WETH_TOKEN_ADDRESS;

    error CallerNotCollector(address caller, address expectedCaller);

    // For future use
    uint256[50] private __gap;

    /**
     * @param _collector Address of the contract that collects the fees
     */
    constructor(address _collector, address _weth) {
        COLLECTOR = _collector;
        WETH_TOKEN_ADDRESS = _weth;
    }

    /*
     * @notice Asserts that the caller is the collector
     */
    function _assertIsCollector() internal view {
        if (msg.sender != COLLECTOR) {
            revert CallerNotCollector(msg.sender, COLLECTOR);
        }
    }

    /*
     * @notice Send all the ETH to the collector
     */
    function collect() external returns (uint256 wethReturned) {
        _assertIsCollector();
        wethReturned = address(this).balance;
        IWETH9(WETH_TOKEN_ADDRESS).deposit{ value: wethReturned }();
        IWETH9(WETH_TOKEN_ADDRESS).transfer(COLLECTOR, wethReturned);
    }
}

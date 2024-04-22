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
    /// @notice The address the WETH is sent to on `collect`.
    address public immutable COLLECTOR;
    /// @notice The address of the Wrapped ETH (WETH) token contract
    address public immutable WETH_TOKEN_ADDRESS;

    error CallerNotCollector(address caller, address expectedCaller);

    // For future use
    uint256[50] private __gap;

    /**
     * @param _collector Address of the contract that collects the fees
     * @param _weth Address of the Wrapped ETH (WETH) token contract
     */
    constructor(address _collector, address _weth) {
        COLLECTOR = _collector;
        WETH_TOKEN_ADDRESS = _weth;
    }

    /**
     * @dev Asserts that the caller is the collector
     */
    function _assertIsCollector() internal view {
        if (msg.sender != COLLECTOR) {
            revert CallerNotCollector(msg.sender, COLLECTOR);
        }
    }

    /**
     * @notice Converts ETH to WETH and sends the WETH to the collector
     * @return weth The amount of WETH sent to the collector
     */
    function collect() external returns (uint256 weth) {
        _assertIsCollector();
        weth = address(this).balance;
        if (weth > 0) {
            IWETH9(WETH_TOKEN_ADDRESS).deposit{ value: weth }();
            IWETH9(WETH_TOKEN_ADDRESS).transfer(COLLECTOR, weth);
        }
    }
}

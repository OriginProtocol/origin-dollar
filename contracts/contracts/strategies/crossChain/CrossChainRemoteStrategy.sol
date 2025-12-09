// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

/**
 * @title Cross-Chain Remote Strategy - the L2 chain part
 * @author Origin Protocol Inc
 */

import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { IERC20 } from "../../utils/InitializableAbstractStrategy.sol";

contract CrossChainRemoteStrategy {
    using SafeERC20 for IERC20;

    /**
     * @dev Returns the address of the Remote part of the strategy on L2
     */
    function masterAddress() internal virtual returns (address) {
        return address(this);
    }
}

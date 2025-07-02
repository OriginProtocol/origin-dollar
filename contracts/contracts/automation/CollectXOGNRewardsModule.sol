// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import { AbstractSafeModule } from "./AbstractSafeModule.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IXOGN {
    function collectRewards() external;
}

contract CollectXOGNRewardsModule is AbstractSafeModule {
    IXOGN public constant xogn =
        IXOGN(0x63898b3b6Ef3d39332082178656E9862bee45C57);
    address public constant rewardsSource =
        0x7609c88E5880e934dd3A75bCFef44E31b1Badb8b;
    IERC20 public constant ogn =
        IERC20(0x8207c1ffc5b6804f6024322ccf34f29c3541ae26);

    constructor(address _safeContract, address operator)
        AbstractSafeModule(_safeContract)
    {
        _grantRole(OPERATOR_ROLE, operator);
    }

    function collectRewards() external onlyOperator {
        uint256 balance = ogn.balanceOf(address(safeContract));

        safeContract.execTransactionFromModule(
            address(xogn),
            0, // Value
            abi.encodeWithSelector(IXOGN.collectRewards.selector),
            0 // Call
        );

        balance = ogn.balanceOf(address(safeContract)) - balance;

        if (balance == 0) {
            return;
        }

        safeContract.execTransactionFromModule(
            address(ogn),
            0, // Value
            abi.encodeWithSelector(
                IERC20.transfer.selector,
                rewardsSource,
                balance
            ),
            0 // Call
        );
    }
}

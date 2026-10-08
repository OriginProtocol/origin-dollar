// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import { AccessControlEnumerable } from "@openzeppelin/contracts/access/AccessControlEnumerable.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { ISafe } from "../interfaces/ISafe.sol";

abstract contract AbstractSafeModule is AccessControlEnumerable {
    ISafe public immutable safeContract;

    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");

    modifier onlySafe() {
        require(
            msg.sender == address(safeContract),
            "Caller is not the safe contract"
        );
        _;
    }

    modifier onlyOperator() {
        require(
            hasRole(OPERATOR_ROLE, msg.sender),
            "Caller is not an operator"
        );
        _;
    }

    constructor(address _safeContract) {
        safeContract = ISafe(_safeContract);
        _grantRole(DEFAULT_ADMIN_ROLE, address(safeContract));
        _grantRole(OPERATOR_ROLE, address(safeContract));
    }

    /**
     * @dev Helps recovering any tokens accidentally sent to this module.
     * @param token Token to transfer. 0x0 to transfer Native token.
     * @param amount Amount to transfer. 0 to transfer all balance.
     */
    function transferTokens(address token, uint256 amount) external onlySafe {
        if (address(token) == address(0)) {
            // Move ETH
            amount = amount > 0 ? amount : address(this).balance;
            payable(address(safeContract)).transfer(amount);
            return;
        }

        // Move all balance if amount set to 0
        amount = amount > 0 ? amount : IERC20(token).balanceOf(address(this));

        // Transfer to Safe contract
        // slither-disable-next-line unchecked-transfer unused-return
        IERC20(token).transfer(address(safeContract), amount);
    }

    receive() external payable {
        // Accept ETH to pay for bridge fees
    }
}

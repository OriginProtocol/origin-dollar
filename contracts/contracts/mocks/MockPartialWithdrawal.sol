// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import { PartialWithdrawal } from "../beacon/PartialWithdrawal.sol";

contract MockPartialWithdrawal {
    function fee() external view returns (uint256) {
        return PartialWithdrawal.fee();
    }

    function request(bytes calldata validatorPubKey, uint64 amount)
        external
        returns (uint256 fee_)
    {
        return PartialWithdrawal.request(validatorPubKey, amount);
    }
}

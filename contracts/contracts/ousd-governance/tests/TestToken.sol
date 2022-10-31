// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "../GovernanceToken.sol";

contract TestToken is OriginDollarGovernance {
    function proof() public {
        revert("Upgraded");
    }
}

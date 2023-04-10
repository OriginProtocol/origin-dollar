// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title OUSD InitializableGovernable Contract
 * @author Origin Protocol Inc
 */
import { Initializable } from "../utils/Initializable.sol";

import { Governable } from "./Governable.sol";

contract InitializableGovernable is Governable, Initializable {
    function _initialize(address _newGovernor) internal {
        _changeGovernor(_newGovernor);
    }
}

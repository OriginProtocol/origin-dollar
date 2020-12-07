pragma solidity 0.5.11;

/**
 * @title OUSD InitializableGovernable Contract
 * @author Origin Protocol Inc
 */
import {
    Initializable
} from "@openzeppelin/upgrades/contracts/Initializable.sol";

import { Governable } from "./Governable.sol";

contract InitializableGovernable is Governable, Initializable {
    function _initialize(address _newGovernor) internal {
        _changeGovernor(_newGovernor);
    }
}

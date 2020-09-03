pragma solidity 0.5.11;

// prettier-ignore
import { Initializable } from "@openzeppelin/upgrades/contracts/Initializable.sol";

import { Governable } from "./Governable.sol";

contract InitializableGovernable is Governable, Initializable {
    function _initialize(address _governor) internal {
        _changeGovernor(_governor);
    }
}

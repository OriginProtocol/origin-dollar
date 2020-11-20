pragma solidity ^0.5.11;
pragma experimental ABIEncoderV2;

import "./Governor.sol";

/**
 * A wrapper around governor contract that doesn't test the
 * delay time boundary. Only to be used with tests
 */
contract TestGovernor is Governor {
    constructor(address admin_, uint256 delay_) public {
        delay = delay_;
        admin = admin_;
    }
}

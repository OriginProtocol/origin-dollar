// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {Base} from "tests/Base.t.sol";

// --- Project imports
import {EndianWrapper} from "tests/mocks/EndianWrapper.sol";

abstract contract Unit_Endian_Shared_Test is Base {
    EndianWrapper internal endianWrapper;

    function setUp() public virtual override {
        super.setUp();
        endianWrapper = new EndianWrapper();
        vm.label(address(endianWrapper), "EndianWrapper");
    }
}

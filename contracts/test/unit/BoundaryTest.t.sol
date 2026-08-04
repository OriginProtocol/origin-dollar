// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;
import {Test} from "forge-std/Test.sol";
contract BoundaryTest is Test {
    function test_setup() public {
        string[] memory c = new string[](2);
        c[0] = "bash";
        c[1] = "contracts/test/helpers/check-rpc.sh";
        vm.ffi(c);
    }
}

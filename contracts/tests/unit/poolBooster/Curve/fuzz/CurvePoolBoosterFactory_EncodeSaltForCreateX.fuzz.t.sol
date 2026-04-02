// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Unit_Curve_Shared_Test} from "tests/unit/poolBooster/Curve/shared/Shared.t.sol";

contract Unit_Fuzz_CurvePoolBoosterFactory_EncodeSaltForCreateX_Test is Unit_Curve_Shared_Test {
    /// @notice Max allowed salt value: 309485009821345068724781055 == type(uint88).max
    uint256 internal constant MAX_SALT = 309485009821345068724781055;

    function testFuzz_encodeSaltForCreateX(uint256 salt) public view {
        salt = bound(salt, 0, MAX_SALT);

        bytes32 encoded = curvePoolBoosterFactory.encodeSaltForCreateX(salt);

        // First 20 bytes must be the factory address
        address extractedAddr = address(bytes20(encoded));
        assertEq(extractedAddr, address(curvePoolBoosterFactory));

        // Byte 20 (0-indexed) must be 0 (the cross-chain protection flag)
        uint8 flag = uint8(encoded[20]);
        assertEq(flag, 0);

        // Last 11 bytes must contain the salt value
        uint256 extractedSalt = uint256(encoded) & ((1 << 88) - 1);
        assertEq(extractedSalt, salt);
    }

    function testFuzz_encodeSaltForCreateX_reverts(uint256 salt) public {
        salt = bound(salt, MAX_SALT + 1, type(uint256).max);

        vm.expectRevert("Invalid salt");
        curvePoolBoosterFactory.encodeSaltForCreateX(salt);
    }
}

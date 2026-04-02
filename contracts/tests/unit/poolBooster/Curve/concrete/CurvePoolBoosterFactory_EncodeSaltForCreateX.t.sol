// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Unit_Curve_Shared_Test} from "tests/unit/poolBooster/Curve/shared/Shared.t.sol";

contract Unit_Concrete_CurvePoolBoosterFactory_EncodeSaltForCreateX_Test is Unit_Curve_Shared_Test {
    function test_encodeSaltForCreateX() public view {
        bytes32 encoded = curvePoolBoosterFactory.encodeSaltForCreateX(1);
        // Verify that the result is non-zero
        assertTrue(encoded != bytes32(0));
    }

    function test_encodeSaltForCreateX_factoryAddress() public view {
        bytes32 encoded = curvePoolBoosterFactory.encodeSaltForCreateX(42);
        // First 20 bytes should be the factory address
        address extractedAddr = address(bytes20(encoded));
        assertEq(extractedAddr, address(curvePoolBoosterFactory));
    }

    function test_encodeSaltForCreateX_flagZero() public view {
        bytes32 encoded = curvePoolBoosterFactory.encodeSaltForCreateX(1);
        // Byte 20 (0-indexed) should be 0 (the cross-chain protection flag)
        uint8 flag = uint8(encoded[20]);
        assertEq(flag, 0);
    }

    function test_encodeSaltForCreateX_saltValue() public view {
        uint256 saltInput = 12345;
        bytes32 encoded = curvePoolBoosterFactory.encodeSaltForCreateX(saltInput);

        // Extract the last 11 bytes and verify the salt is encoded there
        // The salt occupies the lowest 11 bytes (88 bits)
        uint256 extractedSalt = uint256(encoded) & ((1 << 88) - 1);
        assertEq(extractedSalt, saltInput);
    }

    function test_encodeSaltForCreateX_RevertWhen_saltTooLarge() public {
        // Max allowed: 309485009821345068724781055
        uint256 tooLarge = 309485009821345068724781055 + 1;

        vm.expectRevert("Invalid salt");
        curvePoolBoosterFactory.encodeSaltForCreateX(tooLarge);
    }

    function test_encodeSaltForCreateX_maxAllowed() public view {
        // Max allowed salt value should succeed
        uint256 maxSalt = 309485009821345068724781055;
        bytes32 encoded = curvePoolBoosterFactory.encodeSaltForCreateX(maxSalt);

        // Verify factory address is still correctly encoded
        address extractedAddr = address(bytes20(encoded));
        assertEq(extractedAddr, address(curvePoolBoosterFactory));

        // Verify the salt value in the last 11 bytes
        uint256 extractedSalt = uint256(encoded) & ((1 << 88) - 1);
        assertEq(extractedSalt, maxSalt);
    }
}

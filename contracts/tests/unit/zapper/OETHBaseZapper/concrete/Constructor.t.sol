// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Unit_OETHZapper_Shared_Test} from "tests/unit/zapper/OETHZapper/shared/Shared.t.sol";
import {IOETHZapper} from "contracts/interfaces/IOETHZapper.sol";
import {MockWETH} from "contracts/mocks/MockWETH.sol";

contract Unit_Concrete_OETHBaseZapper_Constructor_Test is Unit_OETHZapper_Shared_Test {
    address internal constant BASE_WETH = 0x4200000000000000000000000000000000000006;

    /// @dev Etch MockWETH bytecode at the hardcoded Base WETH address so constructor approvals succeed
    function _etchBaseWETH() internal {
        MockWETH mock = new MockWETH();
        vm.etch(BASE_WETH, address(mock).code);
    }

    function test_constructor_hardcodesBaseWETH() public {
        _etchBaseWETH();

        oethBaseZapper = IOETHZapper(
            vm.deployCode(
                "contracts/zapper/OETHBaseZapper.sol:OETHBaseZapper",
                abi.encode(address(oeth), address(woeth), address(oethVault))
            )
        );

        assertEq(address(oethBaseZapper.weth()), BASE_WETH);
    }

    function test_constructor_setsImmutables() public {
        _etchBaseWETH();

        oethBaseZapper = IOETHZapper(
            vm.deployCode(
                "contracts/zapper/OETHBaseZapper.sol:OETHBaseZapper",
                abi.encode(address(oeth), address(woeth), address(oethVault))
            )
        );

        assertEq(address(oethBaseZapper.oToken()), address(oeth));
        assertEq(address(oethBaseZapper.wOToken()), address(woeth));
        assertEq(address(oethBaseZapper.vault()), address(oethVault));
    }
}

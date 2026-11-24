// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Test} from "forge-std/Test.sol";
import {ICurveAmoRepegModule} from "contracts/interfaces/automation/ICurveAmoRepegModule.sol";
import {MockRepegToken, MockRepegVault, MockRepegAmo, MockRepegSafe} from "tests/mocks/MockCurveAmoRepeg.sol";

interface IRepegCheckerSnapshots {
    function snapshots(address sender) external view returns (uint256 vaultValue, uint256 totalSupply, uint256 time);
}

abstract contract Unit_CurveAmoRepegModule_Shared_Test is Test {
    string internal constant ARTIFACT = "contracts/automation/CurveAmoRepegModule.sol:CurveAmoRepegModule";
    MockRepegSafe internal safe;
    MockRepegToken internal token;
    MockRepegVault internal vault;
    MockRepegAmo internal amo;
    address internal checker;
    address internal operator;
    ICurveAmoRepegModule internal module;

    function setUp() public virtual {
        vm.warp(7 days);
        operator = makeAddr("operator");
        safe = new MockRepegSafe();
        token = new MockRepegToken();
        vault = new MockRepegVault(address(safe), address(token));
        amo = new MockRepegAmo(address(vault));
        vault.setAmo(address(amo));
        checker = vm.deployCode(
            "contracts/strategies/VaultValueChecker.sol:VaultValueChecker", abi.encode(address(vault), address(token))
        );
        module = _deploy(address(safe), operator, address(vault), address(amo), checker, 1e18, 1e18);
    }

    function _deploy(address s, address o, address v, address a, address c, uint256 p, uint256 q)
        internal
        returns (ICurveAmoRepegModule)
    {
        return ICurveAmoRepegModule(vm.deployCode(ARTIFACT, abi.encode(s, o, v, a, c, p, q)));
    }

    function _run() internal {
        vm.prank(operator);
        module.repeg(100e18, 10e18, 1e18, -90e18, 1e18, 0, block.timestamp + 300);
    }

    function _expectRollback() internal view {
        assertEq(module.nonce(), 0);
        assertEq(safe.calls(), 0);
        assertEq(vault.rebaseCount(), 0);
        assertEq(vault.totalValue(), 10_000e18);
        assertEq(token.totalSupply(), 10_000e18);
        assertEq(amo.lpRemoved(), 0);
        (uint256 value, uint256 supply, uint256 time) = IRepegCheckerSnapshots(checker).snapshots(address(safe));
        assertEq(value, 0);
        assertEq(supply, 0);
        assertEq(time, 0);
    }
}

// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Test} from "forge-std/Test.sol";
import {Resolver} from "scripts/deploy/helpers/Resolver.sol";
import {State} from "scripts/deploy/helpers/DeploymentTypes.sol";

interface IFreshHoodiScript {
    function run() external;
}

contract FreshHoodiDeploymentTest is Test {
    IFreshHoodiScript internal script;
    address internal constant WETH = 0x2387fD72C1DA19f6486B843F5da562679FbB4057;
    address internal constant DEPOSIT = 0x00000000219ab540356cBB839Cbe05303d7705Fa;

    function setUp() public {
        vm.chainId(560048);
        vm.warp(1_800_000_000);
        vm.setEnv("DEPLOYER_ADDRESS", vm.toString(address(0xA11CE)));
        vm.setEnv("HOODI_RELAYER_ADDRESS", vm.toString(address(0xCAFE)));
        vm.etch(WETH, vm.getDeployedCode("MockWETH.sol:MockWETH"));
        vm.etch(DEPOSIT, hex"00");
        address registry = address(uint160(uint256(keccak256("Resolver"))));
        vm.etch(registry, vm.getDeployedCode("Resolver.sol:Resolver"));
        Resolver(registry).setState(State.FORK_TEST);
        script = IFreshHoodiScript(vm.deployCode("001_FreshStaking.s.sol:$001_FreshStaking"));
    }

    function test_freshDeploymentRejectsInvalidConfigThenHandsOffMintsAndAllocates() public {
        vm.chainId(1);
        vm.expectRevert("Hoodi only");
        script.run();
        vm.chainId(560048);
        vm.setEnv("HOODI_RELAYER_ADDRESS", "0x419B6BdAE482f41b8B194515749F3A2Da26d583b");
        vm.expectRevert("Invalid Hoodi relayer");
        script.run();
        vm.setEnv("HOODI_RELAYER_ADDRESS", vm.toString(address(0xCAFE)));
        script.run();
    }
}

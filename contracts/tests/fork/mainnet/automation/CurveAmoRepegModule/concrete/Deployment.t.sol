// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {BaseFork} from "tests/fork/BaseFork.t.sol";
import {CrossChain, Mainnet} from "tests/utils/Addresses.sol";
import {State} from "scripts/deploy/helpers/DeploymentTypes.sol";
import {ICurveAmoRepegModule} from "contracts/interfaces/automation/ICurveAmoRepegModule.sol";

interface IRepegDeployResolver {
    function setState(State state) external;
    function addContract(string memory name, address implementation) external;
    function resolve(string memory name) external view returns (address);
}

interface IRepegDeployScript {
    function run() external;
    function skip() external view returns (bool);
}

interface IRepegDeploySafe {
    function isModuleEnabled(address module) external view returns (bool);
}

contract Fork_Mainnet_CurveAmoRepegModule_Deployment_Test is BaseFork {
    function setUp() public override {
        super.setUp();
        _createAndSelectForkMainnet();
    }

    function test_DeploymentRecordsOUSDModuleWithoutEnablingSafe() external {
        address resolverAddress = address(uint160(uint256(keccak256("Resolver"))));
        vm.etch(resolverAddress, vm.getDeployedCode("Resolver.sol:Resolver"));
        IRepegDeployResolver resolver = IRepegDeployResolver(resolverAddress);
        resolver.setState(State.FORK_TEST);
        resolver.addContract("OUSD_PROXY", Mainnet.OUSDProxy);
        resolver.addContract("OUSD_VAULT_PROXY", Mainnet.VaultProxy);
        resolver.addContract("OUSD_CURVE_AMO_STRATEGY", Mainnet.CurveOUSDAMOStrategy);
        IRepegDeployScript script = IRepegDeployScript(
            vm.deployCode("016_DeployOUSDCurveAmoRepegModule.s.sol:$016_DeployOUSDCurveAmoRepegModule")
        );
        assertFalse(script.skip());
        script.run();
        ICurveAmoRepegModule module = ICurveAmoRepegModule(resolver.resolve("OUSD_CURVE_AMO_REPEG_MODULE"));
        assertGt(address(module).code.length, 0);
        assertEq(module.safeContract(), CrossChain.multichainStrategist);
        assertEq(module.vault(), Mainnet.VaultProxy);
        assertEq(module.amo(), Mainnet.CurveOUSDAMOStrategy);
        assertEq(module.checker(), 0x25041Ccb8352b9BA65883a94685aeF07a5aD8739);
        assertEq(module.maxProfitVariance(), 1e18);
        assertEq(module.maxVaultChangeVariance(), 1e18);
        assertTrue(module.hasRole(module.OPERATOR_ROLE(), CrossChain.talosRelayer));
        assertFalse(IRepegDeploySafe(CrossChain.multichainStrategist).isModuleEnabled(address(module)));
    }
}

// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {BaseFork} from "tests/fork/BaseFork.t.sol";
import {CrossChain, Mainnet} from "tests/utils/Addresses.sol";

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ClaimStrategyRewardsSafeModule} from "contracts/automation/ClaimStrategyRewardsSafeModule.sol";

abstract contract Fork_ClaimStrategyRewardsSafeModule_Shared_Test is BaseFork {
    //////////////////////////////////////////////////////
    /// --- CONTRACTS
    //////////////////////////////////////////////////////

    IERC20 internal morphoToken;

    //////////////////////////////////////////////////////
    /// --- ADDRESSES
    //////////////////////////////////////////////////////

    address internal safeSigner;

    // Curve strategies
    address internal ousdCurveAMOProxy;
    address internal oethCurveAMOProxy;

    // Morpho strategies
    address internal morphoGauntletUSDCProxy;
    address internal morphoGauntletUSDTProxy;
    address internal metaMorphoProxy;

    //////////////////////////////////////////////////////
    /// --- SETUP
    //////////////////////////////////////////////////////

    function setUp() public virtual override {
        super.setUp();

        _createAndSelectForkMainnet();
        _loadForkContracts();
        _deployModule();
        _enableModuleOnSafe();
        _labelContracts();
    }

    function _loadForkContracts() internal {
        safeSigner = CrossChain.multichainStrategist;
        crv = IERC20(Mainnet.CRV);
        morphoToken = IERC20(Mainnet.MorphoToken);

        ousdCurveAMOProxy = Mainnet.CurveOUSDAMOStrategy;
        oethCurveAMOProxy = Mainnet.CurveOETHAMOStrategy;

        morphoGauntletUSDCProxy = Mainnet.MorphoGauntletPrimeUSDCStrategyProxy;
        morphoGauntletUSDTProxy = Mainnet.MorphoGauntletPrimeUSDTStrategyProxy;
        metaMorphoProxy = Mainnet.MetaMorphoStrategyProxy;
    }

    function _deployModule() internal {
        // Pass all 5 strategies in constructor (as the Hardhat test does)
        address[] memory strategies = new address[](5);
        strategies[0] = ousdCurveAMOProxy;
        strategies[1] = oethCurveAMOProxy;
        strategies[2] = morphoGauntletUSDCProxy;
        strategies[3] = morphoGauntletUSDTProxy;
        strategies[4] = metaMorphoProxy;

        claimStrategyRewardsModule = new ClaimStrategyRewardsSafeModule(safeSigner, safeSigner, strategies);
    }

    function _enableModuleOnSafe() internal {
        vm.prank(safeSigner);
        (bool success,) =
            safeSigner.call(abi.encodeWithSignature("enableModule(address)", address(claimStrategyRewardsModule)));
        require(success, "Failed to enable module");
    }

    function _labelContracts() internal {
        vm.label(address(claimStrategyRewardsModule), "ClaimStrategyRewardsSafeModule");
        vm.label(address(crv), "CRV");
        vm.label(address(morphoToken), "MorphoToken");
        vm.label(safeSigner, "SafeSigner");
        vm.label(ousdCurveAMOProxy, "OUSDCurveAMO");
        vm.label(oethCurveAMOProxy, "OETHCurveAMO");
        vm.label(morphoGauntletUSDCProxy, "MorphoGauntletUSDC");
        vm.label(morphoGauntletUSDTProxy, "MorphoGauntletUSDT");
        vm.label(metaMorphoProxy, "MetaMorpho");
    }
}

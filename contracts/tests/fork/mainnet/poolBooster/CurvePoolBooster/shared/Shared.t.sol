// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {BaseFork} from "tests/fork/BaseFork.t.sol";

// --- Test utilities
import {PoolBoosters} from "tests/utils/Artifacts.sol";

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {MockERC20} from "@solmate/test/utils/mocks/MockERC20.sol";

import {ICurvePoolBooster} from "contracts/interfaces/poolBooster/ICurvePoolBooster.sol";
import {ICurvePoolBoosterFactory} from "contracts/interfaces/poolBooster/ICurvePoolBoosterFactory.sol";
import {IPoolBoostCentralRegistryFull} from "contracts/interfaces/poolBooster/IPoolBoostCentralRegistryFull.sol";

import {Mainnet} from "tests/utils/Addresses.sol";
import {CrossChain} from "tests/utils/Addresses.sol";

abstract contract Fork_CurvePoolBooster_Shared_Test is BaseFork {
    //////////////////////////////////////////////////////
    /// --- CONSTANTS
    //////////////////////////////////////////////////////

    bytes32 internal constant GOVERNOR_SLOT = 0x7bea13895fa79d2831e0a9e28edede30099005a50d652d8957cf8a607ee6ca4a;

    //////////////////////////////////////////////////////
    /// --- CONTRACTS
    //////////////////////////////////////////////////////

    IPoolBoostCentralRegistryFull internal centralRegistry;
    ICurvePoolBooster internal curvePoolBoosterPlain;
    ICurvePoolBoosterFactory internal curvePoolBoosterFactory;

    //////////////////////////////////////////////////////
    /// --- LOCAL VARIABLES
    //////////////////////////////////////////////////////

    IERC20 internal ousdToken;

    //////////////////////////////////////////////////////
    /// --- SETUP
    //////////////////////////////////////////////////////

    function setUp() public virtual override {
        super.setUp();

        _createAndSelectForkMainnet();
        _deployFreshContracts();
        _labelContracts();
    }

    function _deployFreshContracts() internal {
        // 1. Deploy fresh MockERC20 as OUSD
        ousdToken = IERC20(address(new MockERC20("Origin Dollar", "OUSD", 18)));

        // 2. Deploy PoolBoostCentralRegistry and set governor via storage slot
        centralRegistry = IPoolBoostCentralRegistryFull(vm.deployCode(PoolBoosters.POOL_BOOST_CENTRAL_REGISTRY));
        vm.store(address(centralRegistry), GOVERNOR_SLOT, bytes32(uint256(uint160(Mainnet.Timelock))));

        // 3. Deploy CurvePoolBoosterPlain
        curvePoolBoosterPlain = ICurvePoolBooster(
            vm.deployCode(
                PoolBoosters.CURVE_POOL_BOOSTER_PLAIN, abi.encode(address(ousdToken), Mainnet.CurveOUSDUSDTGauge)
            )
        );
        curvePoolBoosterPlain.initialize(
            Mainnet.Timelock,
            CrossChain.multichainStrategist,
            0,
            CrossChain.multichainStrategist,
            Mainnet.CampaignRemoteManager,
            CrossChain.votemarket
        );

        // 4. Deploy CurvePoolBoosterFactory
        curvePoolBoosterFactory = ICurvePoolBoosterFactory(vm.deployCode(PoolBoosters.CURVE_POOL_BOOSTER_FACTORY));
        curvePoolBoosterFactory.initialize(Mainnet.Timelock, CrossChain.multichainStrategist, address(centralRegistry));

        // 5. Approve factory on registry
        vm.prank(Mainnet.Timelock);
        centralRegistry.approveFactory(address(curvePoolBoosterFactory));

        // 6. Fund strategist with ETH for bridge fees
        vm.deal(CrossChain.multichainStrategist, 10 ether);
    }

    function _labelContracts() internal {
        vm.label(address(ousdToken), "OUSD (MockERC20)");
        vm.label(address(centralRegistry), "CentralRegistry");
        vm.label(address(curvePoolBoosterPlain), "CurvePoolBoosterPlain");
        vm.label(address(curvePoolBoosterFactory), "CurvePoolBoosterFactory");
    }

    //////////////////////////////////////////////////////
    /// --- HELPERS
    //////////////////////////////////////////////////////

    function _dealOUSD(address _to, uint256 _amount) internal {
        MockERC20(address(ousdToken)).mint(_to, _amount);
    }

    function _dealOUSDAndCreateCampaign() internal {
        // Mint 10 OUSD to pool booster
        _dealOUSD(address(curvePoolBoosterPlain), 10 ether);

        // Create campaign as strategist
        address[] memory blacklist = new address[](1);
        blacklist[0] = Mainnet.ConvexVoter;

        vm.prank(CrossChain.multichainStrategist);
        curvePoolBoosterPlain.createCampaign{value: 0.1 ether}(4, 10, blacklist, 0);
    }
}

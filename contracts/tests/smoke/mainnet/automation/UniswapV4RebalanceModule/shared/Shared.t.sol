// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {BaseSmoke} from "tests/smoke/BaseSmoke.t.sol";

// --- Test utilities
import {CrossChain, Mainnet} from "tests/utils/Addresses.sol";
import {V4Swapper} from "tests/fork/mainnet/automation/UniswapV4RebalanceModule/shared/V4Swapper.sol";

// --- Project imports
import {IOToken} from "contracts/interfaces/IOToken.sol";
import {IUniswapV4RebalanceModule} from "contracts/interfaces/automation/IUniswapV4RebalanceModule.sol";
import {PoolKey} from "contracts/interfaces/uniswap/v4/IPoolManager.sol";
import {IPositionManager} from "contracts/interfaces/uniswap/v4/IPositionManager.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @dev Runs the deployed module against the live OUSD/USDe position. The Safe and the position
///      only exist from block 26181117, so the suite skips on older fork pins.
abstract contract Smoke_UniswapV4RebalanceModule_Shared_Test is BaseSmoke {
    IUniswapV4RebalanceModule internal module;
    IPositionManager internal positionManager;
    IOToken internal ousd;
    IERC20 internal usde;
    address internal safe;
    uint256 internal tokenId;
    PoolKey internal key;
    V4Swapper internal trader;

    function setUp() public virtual override {
        super.setUp();
        _createAndSelectForkMainnet();

        positionManager = IPositionManager(Mainnet.uniswapV4PositionManager);
        if (
            Mainnet.ousdV4LiquiditySafe.code.length == 0
                || positionManager.nextTokenId() <= Mainnet.ousdUsdeV4PositionId
        ) {
            vm.skip(true);
        }

        _igniteDeployManager();
        require(address(resolver).code.length > 0, "Resolver not initialized on fork");

        module = IUniswapV4RebalanceModule(resolver.resolve("UNISWAP_V4_REBALANCE_MODULE"));
        ousd = IOToken(Mainnet.OUSDProxy);
        usde = IERC20(Mainnet.USDe);
        safe = Mainnet.ousdV4LiquiditySafe;
        tokenId = Mainnet.ousdUsdeV4PositionId;
        key = module.getPosition(tokenId).key;

        trader = new V4Swapper(module.poolManager());
        deal(address(usde), address(trader), 100_000e18);

        vm.label(address(module), "UniswapV4RebalanceModule");
        vm.label(safe, "OUSDv4LiquiditySafe");
        vm.label(CrossChain.talosRelayer, "TalosRelayer");
    }

    function _sellUsde(uint256 amount) internal {
        trader.swap(key, false, amount);
    }

    function _rebalance() internal returns (bool added) {
        vm.prank(CrossChain.talosRelayer);
        added = module.rebalance(tokenId);
    }
}

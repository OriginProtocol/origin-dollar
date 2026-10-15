// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {BaseSmoke} from "tests/smoke/BaseSmoke.t.sol";

// --- Test utilities
import {CrossChain, Mainnet} from "tests/utils/Addresses.sol";

// --- Project imports
import {IOToken} from "contracts/interfaces/IOToken.sol";
import {IUniswapV4ERC4626RebalanceModule} from "contracts/interfaces/automation/IUniswapV4ERC4626RebalanceModule.sol";
import {IPositionManager} from "contracts/interfaces/uniswap/v4/IPositionManager.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @dev Runs the deployed module against the live OUSD/sUSDe position. The Safe and the position
///      only exist from block 26181117, so the suite skips on older fork pins.
abstract contract Smoke_UniswapV4ERC4626RebalanceModule_Shared_Test is BaseSmoke {
    IUniswapV4ERC4626RebalanceModule internal module;
    IPositionManager internal positionManager;
    IOToken internal ousd;
    IERC20 internal susde;
    address internal safe;
    uint256 internal tokenId;

    function setUp() public virtual override {
        super.setUp();
        _createAndSelectForkMainnet();

        positionManager = IPositionManager(Mainnet.uniswapV4PositionManager);
        if (
            Mainnet.ousdV4LiquiditySafe.code.length == 0
                || positionManager.nextTokenId() <= Mainnet.ousdSusdeV4PositionId
        ) {
            vm.skip(true);
        }

        _igniteDeployManager();
        require(address(resolver).code.length > 0, "Resolver not initialized on fork");

        module = IUniswapV4ERC4626RebalanceModule(resolver.resolve("UNISWAP_V4_ERC4626_REBALANCE_MODULE"));
        ousd = IOToken(Mainnet.OUSDProxy);
        susde = IERC20(Mainnet.sUSDe);
        safe = Mainnet.ousdV4LiquiditySafe;
        tokenId = Mainnet.ousdSusdeV4PositionId;

        vm.label(address(module), "UniswapV4ERC4626RebalanceModule");
        vm.label(safe, "OUSDv4LiquiditySafe");
        vm.label(CrossChain.talosRelayer, "TalosRelayer");
    }

    /// @dev Smallest sqrtPriceX96 at or above the sUSDe NAV.
    function _navSqrtPriceX96() internal view returns (uint160) {
        uint256 x = module.navPriceX192();
        uint256 r = x;
        uint256 z = (x >> 1) + 1;
        while (z < r) {
            r = z;
            z = (x / z + z) >> 1;
        }
        if (r * r < x) r++;
        return uint160(r);
    }

    function _tick() internal view returns (int24) {
        bytes32 slot0 =
            IPoolManagerSlots(module.poolManager()).extsload(keccak256(abi.encode(module.poolId(), uint256(6))));
        return int24(int256(uint256(slot0) >> 160));
    }
}

interface IPoolManagerSlots {
    function extsload(bytes32 slot) external view returns (bytes32);
}

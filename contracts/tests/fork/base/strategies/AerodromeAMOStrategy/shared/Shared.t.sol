// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {BaseFork} from "tests/fork/BaseFork.t.sol";

// --- Test utilities
import {Base as BaseAddresses} from "tests/utils/Addresses.sol";
import {Proxies} from "tests/utils/artifacts/Proxies.sol";
import {Strategies} from "tests/utils/artifacts/Strategies.sol";
import {Tokens} from "tests/utils/artifacts/Tokens.sol";
import {Vaults} from "tests/utils/artifacts/Vaults.sol";

// --- External libraries
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";

import {InitializableAbstractStrategy} from "contracts/utils/InitializableAbstractStrategy.sol";
import {IOToken} from "contracts/interfaces/IOToken.sol";
import {IProxy} from "contracts/interfaces/IProxy.sol";
import {IVault} from "contracts/interfaces/IVault.sol";
import {INonfungiblePositionManager} from "contracts/interfaces/aerodrome/INonfungiblePositionManager.sol";
import {ICLGauge} from "contracts/interfaces/aerodrome/ICLGauge.sol";
import {ISwapRouter} from "contracts/interfaces/aerodrome/ISwapRouter.sol";
import {ISugarHelper} from "contracts/interfaces/aerodrome/ISugarHelper.sol";
import {IAerodromeAMOStrategy} from "contracts/interfaces/strategies/IAerodromeAMOStrategy.sol";
import {AerodromeAMOQuoter, QuoterHelper} from "contracts/utils/AerodromeAMOQuoter.sol";

abstract contract Fork_AerodromeAMOStrategy_Shared_Test is BaseFork {
    //////////////////////////////////////////////////////
    /// --- CONSTANTS
    //////////////////////////////////////////////////////

    bytes32 internal constant GOVERNOR_SLOT = 0x7bea13895fa79d2831e0a9e28edede30099005a50d652d8957cf8a607ee6ca4a;

    /// @dev Midpoint of tick [-1, 0]: ~50% WETH share
    uint160 internal constant DEFAULT_POOL_PRICE = 79225993174662999300183987080;

    /// @dev Wide price limits for swaps
    uint160 internal constant SQRT_RATIO_TICK_M1000 = 75364347830767020784054125655;
    uint160 internal constant SQRT_RATIO_TICK_1000 = 83290069058676223003182343270;

    address internal constant DEAD_ADDRESS = address(0xdead);

    //////////////////////////////////////////////////////
    /// --- CONTRACTS
    //////////////////////////////////////////////////////

    IOToken internal oethBase;
    IVault internal oethBaseVault;
    IProxy internal oethBaseProxy;
    IProxy internal oethBaseVaultProxy;
    IAerodromeAMOStrategy internal aerodromeAMOStrategy;
    AerodromeAMOQuoter internal aerodromeAMOQuoter;
    INonfungiblePositionManager internal positionManager;
    ISwapRouter internal swapRouter;
    ISugarHelper internal sugarHelper;
    ICLGauge internal clGauge;
    IERC20 internal aero;
    address internal clPool;
    address internal harvester;

    //////////////////////////////////////////////////////
    /// --- SETUP
    //////////////////////////////////////////////////////

    function setUp() public virtual override {
        super.setUp();

        _createAndSelectForkBase();
        _deployContracts();
        _labelContracts();
    }

    function _deployContracts() internal {
        // Assign from fork
        weth = IERC20(BaseAddresses.WETH);
        aero = IERC20(BaseAddresses.AERO);
        positionManager = INonfungiblePositionManager(BaseAddresses.nonFungiblePositionManager);
        swapRouter = ISwapRouter(BaseAddresses.swapRouter);
        sugarHelper = ISugarHelper(BaseAddresses.sugarHelper);

        vm.startPrank(deployer);

        address oethBaseImpl = vm.deployCode(Tokens.OETH_BASE);
        address oethBaseVaultImpl = vm.deployCode(Vaults.OETH_BASE, abi.encode(BaseAddresses.WETH));

        oethBaseProxy = IProxy(vm.deployCode(Proxies.IG_PROXY));
        oethBaseVaultProxy = IProxy(vm.deployCode(Proxies.IG_PROXY));

        oethBaseProxy.initialize(
            oethBaseImpl,
            governor,
            abi.encodeWithSignature("initialize(address,uint256)", address(oethBaseVaultProxy), 1e27)
        );

        oethBaseVaultProxy.initialize(
            oethBaseVaultImpl, governor, abi.encodeWithSignature("initialize(address)", address(oethBaseProxy))
        );

        vm.stopPrank();

        oethBase = IOToken(address(oethBaseProxy));
        oethBaseVault = IVault(address(oethBaseVaultProxy));

        // Configure vault
        vm.startPrank(governor);
        oethBaseVault.unpauseCapital();
        oethBaseVault.setStrategistAddr(strategist);
        oethBaseVault.setMaxSupplyDiff(5e16);
        oethBaseVault.setDripDuration(0);
        oethBaseVault.setRebaseRateMax(200e18);
        vm.stopPrank();

        // Create CL pool via CLFactory
        // WETH (0x4200...0006) < fresh OETHBase address → token0=WETH, token1=OETHBase
        require(BaseAddresses.WETH < address(oethBase), "WETH must be token0");

        (bool success, bytes memory data) = BaseAddresses.slipstreamPoolFactory
            .call(
                abi.encodeWithSignature(
                    "createPool(address,address,int24,uint160)",
                    BaseAddresses.WETH,
                    address(oethBase),
                    int24(1),
                    DEFAULT_POOL_PRICE
                )
            );
        require(success, "Pool creation failed");
        clPool = abi.decode(data, (address));

        // Create gauge via Voter
        // Try permissionless first, prank as gauge governor if restricted
        (success, data) = BaseAddresses.aeroVoterAddress
            .call(abi.encodeWithSignature("createGauge(address,address)", BaseAddresses.slipstreamPoolFactory, clPool));
        if (!success) {
            vm.prank(BaseAddresses.aeroGaugeGovernorAddress);
            (success, data) = BaseAddresses.aeroVoterAddress
                .call(
                    abi.encodeWithSignature("createGauge(address,address)", BaseAddresses.slipstreamPoolFactory, clPool)
                );
            require(success, "Gauge creation failed");
        }
        address gaugeAddr = abi.decode(data, (address));
        clGauge = ICLGauge(gaugeAddr);

        aerodromeAMOStrategy = IAerodromeAMOStrategy(
            vm.deployCode(
                Strategies.AERODROME_AMO_STRATEGY,
                abi.encode(
                    InitializableAbstractStrategy.BaseStrategyConfig({
                        platformAddress: clPool, vaultAddress: address(oethBaseVault)
                    }),
                    BaseAddresses.WETH,
                    address(oethBase),
                    address(swapRouter),
                    address(positionManager),
                    clPool,
                    gaugeAddr,
                    address(sugarHelper),
                    int24(-1),
                    int24(0),
                    int24(0)
                )
            )
        );

        // Reset initializer (constructor marks implementation as initialized)
        vm.store(address(aerodromeAMOStrategy), bytes32(0), bytes32(0));

        // Set governor via storage slot
        vm.store(address(aerodromeAMOStrategy), GOVERNOR_SLOT, bytes32(uint256(uint160(governor))));

        // Initialize with AERO reward token
        address[] memory rewardTokens = new address[](1);
        rewardTokens[0] = BaseAddresses.AERO;
        vm.prank(governor);
        aerodromeAMOStrategy.initialize(rewardTokens);

        // Configure wide allowed WETH share interval for initial setup
        // Fresh pool starts at ~50% WETH share; we narrow after establishing position
        vm.prank(governor);
        aerodromeAMOStrategy.setAllowedPoolWethShareInterval(0.010000001 ether, 0.6 ether);

        // Approve all tokens
        vm.prank(governor);
        aerodromeAMOStrategy.safeApproveAllTokens();

        // Register strategy with vault
        vm.startPrank(governor);
        oethBaseVault.approveStrategy(address(aerodromeAMOStrategy));
        oethBaseVault.addStrategyToMintWhitelist(address(aerodromeAMOStrategy));
        vm.stopPrank();

        // Set harvester
        harvester = makeAddr("Harvester");
        vm.prank(governor);
        aerodromeAMOStrategy.setHarvesterAddress(harvester);

        aerodromeAMOQuoter = new AerodromeAMOQuoter(address(aerodromeAMOStrategy), BaseAddresses.quoterV2);

        // Seed dead-address liquidity (precondition for strategy)
        _seedDeadAddressLiquidity();

        // Seed out-of-range liquidity for swap tests
        _seedOutOfRangeLiquidity();

        // Seed vault for solvency
        _seedVaultForSolvency(1000 ether);

        // Initial deposit + rebalance to establish LP position
        // First rebalance at midpoint (~50% WETH share) with wide interval
        _depositAsVault(5 ether);
        vm.prank(strategist);
        aerodromeAMOStrategy.rebalance(0, true, 0);

        // Swap OETHb for WETH to push pool price towards tick 0 (lower WETH share)
        _swapOnPool(4 ether, false);

        // Deposit more WETH and rebalance at new price point (~10% WETH share)
        _depositAsVault(5 ether);
        vm.prank(strategist);
        aerodromeAMOStrategy.rebalance(0, true, 0);

        // Now narrow to production-like interval
        vm.prank(governor);
        aerodromeAMOStrategy.setAllowedPoolWethShareInterval(0.010000001 ether, 0.15 ether);
    }

    function _labelContracts() internal {
        vm.label(address(aerodromeAMOStrategy), "AerodromeAMOStrategy");
        vm.label(address(oethBase), "OETHBase");
        vm.label(address(oethBaseVault), "OETHBaseVault");
        vm.label(BaseAddresses.WETH, "WETH");
        vm.label(BaseAddresses.AERO, "AERO");
        vm.label(address(positionManager), "PositionManager");
        vm.label(address(swapRouter), "SwapRouter");
        vm.label(address(sugarHelper), "SugarHelper");
        vm.label(clPool, "CLPool");
        vm.label(address(clGauge), "CLGauge");
        vm.label(harvester, "Harvester");
    }

    //////////////////////////////////////////////////////
    /// --- HELPERS
    //////////////////////////////////////////////////////

    /// @dev Deal WETH to strategy then call deposit as vault
    function _depositAsVault(uint256 amount) internal {
        deal(BaseAddresses.WETH, address(aerodromeAMOStrategy), amount);
        vm.prank(address(oethBaseVault));
        aerodromeAMOStrategy.deposit(BaseAddresses.WETH, amount);
    }

    /// @dev Seed the vault with WETH to ensure solvency
    function _seedVaultForSolvency(uint256 amount) internal {
        deal(BaseAddresses.WETH, address(oethBaseVault), amount);
    }

    /// @dev Mint small NFT position in [-1, 0] to dead address (strategy precondition)
    function _seedDeadAddressLiquidity() internal {
        uint256 smallAmount = 0.001 ether;
        deal(BaseAddresses.WETH, address(this), smallAmount);
        IERC20(BaseAddresses.WETH).approve(address(positionManager), smallAmount);

        // Mint OETHb for the position
        vm.prank(address(oethBaseVault));
        oethBase.mint(address(this), smallAmount);
        oethBase.approve(address(positionManager), smallAmount);

        (uint256 nftTokenId,,,) = positionManager.mint(
            INonfungiblePositionManager.MintParams({
                token0: BaseAddresses.WETH,
                token1: address(oethBase),
                tickSpacing: int24(1),
                tickLower: int24(-1),
                tickUpper: int24(0),
                amount0Desired: smallAmount,
                amount1Desired: smallAmount,
                amount0Min: 0,
                amount1Min: 0,
                recipient: address(this),
                deadline: block.timestamp + 1000,
                sqrtPriceX96: 0
            })
        );

        // Transfer NFT to dead address
        IERC721(address(positionManager)).transferFrom(address(this), DEAD_ADDRESS, nftTokenId);
    }

    /// @dev Seed out-of-range liquidity at [-3, -1] and [0, 3] for swap tests
    function _seedOutOfRangeLiquidity() internal {
        uint256 amount = 100 ether;

        // Deal WETH
        deal(BaseAddresses.WETH, address(this), amount * 2);
        IERC20(BaseAddresses.WETH).approve(address(positionManager), amount * 2);

        // Mint OETHb
        vm.prank(address(oethBaseVault));
        oethBase.mint(address(this), amount * 2);
        oethBase.approve(address(positionManager), amount * 2);

        // Position at [-3, -1] (below active tick)
        (uint256 nftId1,,,) = positionManager.mint(
            INonfungiblePositionManager.MintParams({
                token0: BaseAddresses.WETH,
                token1: address(oethBase),
                tickSpacing: int24(1),
                tickLower: int24(-3),
                tickUpper: int24(-1),
                amount0Desired: amount,
                amount1Desired: amount,
                amount0Min: 0,
                amount1Min: 0,
                recipient: address(this),
                deadline: block.timestamp + 1000,
                sqrtPriceX96: 0
            })
        );
        IERC721(address(positionManager)).transferFrom(address(this), DEAD_ADDRESS, nftId1);

        // Position at [0, 3] (above active tick)
        (uint256 nftId2,,,) = positionManager.mint(
            INonfungiblePositionManager.MintParams({
                token0: BaseAddresses.WETH,
                token1: address(oethBase),
                tickSpacing: int24(1),
                tickLower: int24(0),
                tickUpper: int24(3),
                amount0Desired: amount,
                amount1Desired: amount,
                amount0Min: 0,
                amount1Min: 0,
                recipient: address(this),
                deadline: block.timestamp + 1000,
                sqrtPriceX96: 0
            })
        );
        IERC721(address(positionManager)).transferFrom(address(this), DEAD_ADDRESS, nftId2);
    }

    /// @dev Swap on the real pool via swapRouter
    function _swapOnPool(uint256 amount, bool swapWeth) internal {
        address tokenIn;
        address tokenOut;

        if (swapWeth) {
            tokenIn = BaseAddresses.WETH;
            tokenOut = address(oethBase);
            deal(BaseAddresses.WETH, nick, amount);
            vm.prank(nick);
            IERC20(BaseAddresses.WETH).approve(address(swapRouter), amount);
        } else {
            tokenIn = address(oethBase);
            tokenOut = BaseAddresses.WETH;
            // Mint OETHb to nick via vault
            vm.prank(address(oethBaseVault));
            oethBase.mint(nick, amount);
            vm.prank(nick);
            oethBase.approve(address(swapRouter), amount);
        }

        vm.prank(nick);
        swapRouter.exactInputSingle(
            ISwapRouter.ExactInputSingleParams({
                tokenIn: tokenIn,
                tokenOut: tokenOut,
                tickSpacing: int24(1),
                recipient: nick,
                deadline: block.timestamp + 1000,
                amountIn: amount,
                amountOutMinimum: 0,
                sqrtPriceLimitX96: swapWeth ? SQRT_RATIO_TICK_M1000 : SQRT_RATIO_TICK_1000
            })
        );
    }

    /// @dev Assert LP token is staked in gauge
    function _assertLpStakedInGauge() internal view {
        uint256 _tokenId = aerodromeAMOStrategy.tokenId();
        assertEq(positionManager.ownerOf(_tokenId), address(clGauge), "LP not staked in gauge");
    }

    /// @dev Assert LP token is NOT staked in gauge (owned by strategy)
    function _assertLpNotStakedInGauge() internal view {
        uint256 _tokenId = aerodromeAMOStrategy.tokenId();
        assertEq(positionManager.ownerOf(_tokenId), address(aerodromeAMOStrategy), "LP should not be in gauge");
    }

    /// @dev Verify end conditions: LP staked + no residual tokens
    function _verifyEndConditions(bool lpStaked) internal view {
        if (lpStaked) {
            _assertLpStakedInGauge();
        } else {
            _assertLpNotStakedInGauge();
        }

        assertLe(
            IERC20(BaseAddresses.WETH).balanceOf(address(aerodromeAMOStrategy)),
            0.00001 ether,
            "Residual WETH on strategy"
        );
        assertEq(oethBase.balanceOf(address(aerodromeAMOStrategy)), 0, "Residual OETHb on strategy");
    }

    /// @dev Use the quoter to find swap amount for rebalance, then execute rebalance.
    ///      Handles governance transfer to quoterHelper for binary search.
    /// @param overrideBottom New allowedWethShareStart (type(uint256).max to keep current)
    /// @param overrideTop New allowedWethShareEnd (type(uint256).max to keep current)
    function _quoteAndRebalance(uint256 overrideBottom, uint256 overrideTop) internal {
        QuoterHelper quoterHelper = aerodromeAMOQuoter.quoterHelper();

        // Transfer governance to quoterHelper so it can call rebalance in try/catch
        vm.prank(governor);
        aerodromeAMOStrategy.transferGovernance(address(quoterHelper));
        aerodromeAMOQuoter.claimGovernance();

        // Quote the amount
        AerodromeAMOQuoter.Data memory data =
            aerodromeAMOQuoter.quoteAmountToSwapBeforeRebalance(overrideBottom, overrideTop);

        // Give back governance
        aerodromeAMOQuoter.giveBackGovernance();
        vm.prank(governor);
        aerodromeAMOStrategy.claimGovernance();

        // Execute rebalance with quoted amount
        bool swapWeth = quoterHelper.getSwapDirectionForRebalance();
        uint256 minAmount = (data.amount * 99) / 100;
        vm.prank(strategist);
        aerodromeAMOStrategy.rebalance(data.amount, swapWeth, minAmount);
    }

    /// @dev Push pool price to a target sqrtPriceX96 by swapping a large amount with the target as limit.
    ///      Direction is auto-detected: target < current → swap WETH in; target > current → swap OETHb in.
    function _pushPoolPrice(uint160 targetSqrtPriceX96) internal {
        uint160 currentPrice = aerodromeAMOStrategy.getPoolX96Price();
        // target < current: need to push price DOWN → swap WETH in (zeroForOne)
        bool swapWeth = targetSqrtPriceX96 < currentPrice;
        uint256 amount = 50 ether;

        address tokenIn;
        address tokenOut;

        if (swapWeth) {
            tokenIn = BaseAddresses.WETH;
            tokenOut = address(oethBase);
            deal(BaseAddresses.WETH, nick, amount);
            vm.prank(nick);
            IERC20(BaseAddresses.WETH).approve(address(swapRouter), amount);
        } else {
            tokenIn = address(oethBase);
            tokenOut = BaseAddresses.WETH;
            vm.prank(address(oethBaseVault));
            oethBase.mint(nick, amount);
            vm.prank(nick);
            oethBase.approve(address(swapRouter), amount);
        }

        vm.prank(nick);
        swapRouter.exactInputSingle(
            ISwapRouter.ExactInputSingleParams({
                tokenIn: tokenIn,
                tokenOut: tokenOut,
                tickSpacing: int24(1),
                recipient: nick,
                deadline: block.timestamp + 1000,
                amountIn: amount,
                amountOutMinimum: 0,
                sqrtPriceLimitX96: targetSqrtPriceX96
            })
        );
    }

    /// @dev ERC721 receiver callback (needed for positionManager.mint in setUp)
    function onERC721Received(address, address, uint256, bytes calldata) external pure returns (bytes4) {
        return this.onERC721Received.selector;
    }
}

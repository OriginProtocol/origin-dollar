pragma solidity ^0.8.19;

import "../Base.t.sol";
import { IMintableERC20, MintableERC20, ERC20 } from "../../../contracts/mocks/MintableERC20.sol";
import { IRewardStaking } from "../../../contracts/strategies/IRewardStaking.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ConvexOUSDMetaStrategy} from "../../../contracts/strategies/ConvexOUSDMetaStrategy.sol";
import {BaseConvexMetaStrategy} from "../../../contracts/strategies/BaseConvexMetaStrategy.sol";
import {MockBooster} from "./MockBooster.sol";
import {MockCVX} from "../../../contracts/mocks/curve/MockCVX.sol";
import {MockCRV} from "../../../contracts/mocks/curve/MockCRV.sol";
import {MockCurveMetapool} from "./MockCurveMetapool.sol";
import {MockRewardPool} from "./MockRewardPool.sol";

contract MockDepositToken is MintableERC20 {
    constructor() ERC20("DCVX", "CVX Deposit Token") {}
}

contract MetaOUSD is Base {
    uint constant agentAmount = 10 ether;
    address strategist;
    address bob;
    address alice;
    address rewardRecipient;
    ConvexOUSDMetaStrategy meta;
    MockBooster mockBooster;
    MockCVX mockCVX;
    MockCRV mockCRV;
    MockCurveMetapool metapool;
    MockRewardPool mockRewardPool;

    address CRV = 0xD533a949740bb3306d119CC777fa900bA034cd52;
    address ThreePool = 0xbEbc44782C7dB0a1A60Cb6fe97d0b483032FF1C7;
    address ThreePoolToken = 0x6c3F90f043a72FA612cbac8115EE7e52BDe6E490;
    address CVX = 0x4e3FBD56CD56c3e72c1403e103b45Db9da5B9D2B;

    struct LogInfo {
        uint state; // 1 mint, 2 redeem
        address target;
        uint oldOusdBalance;
        uint newOusdBalance;
        uint oldStableBalance;
        uint newStableBalance;
    }

    LogInfo[] pnmLogs;

    function setUp() public override {
        rpc_url = "https://eth-mainnet.g.alchemy.com/v2/aWKDYS_qpAtrZb4ao1QYRSQTMA7Hbkcc";
        platformAddress = address(this);

        super.setUp();

        bob = makeAddr("Bob");
        alice = makeAddr("Alice");

        strategist = makeAddr("Strategist");
        rewardRecipient = makeAddr("rewardRecipient");

        vm.label(CRV, "CRV");
        vm.label(CVX, "CVX");
        vm.label(ThreePool, "ThreePool");
        vm.label(ThreePoolToken, "ThreePoolToken");

        
        // address agent = getAgent();
        // deal(WETH, agent, 100 ether);
        // deal(DAI, agent, agentAmount);
        // deal(USDT, agent, agentAmount);
        // deal(USDC, agent, agentAmount);

        vm.startPrank(owner);

        meta = new ConvexOUSDMetaStrategy();
        address[] memory _rewardTokenAddresses = new address[](2);
        _rewardTokenAddresses[0] = CVX;
        _rewardTokenAddresses[1] = CRV;
        address[] memory _assets = new address[](3);
        _assets[0] = DAI;
        _assets[1] = USDC;
        _assets[2] = USDT;
        address[] memory _pTokens = new address[](3);
        _pTokens[0] = ThreePoolToken;
        _pTokens[1] = ThreePoolToken;
        _pTokens[2] = ThreePoolToken;

        mockCVX = new MockCVX();
        mockCRV = new MockCRV();

        address[2] memory coins;
        coins[0] = address(ousd);
        coins[1] = ThreePoolToken;
        metapool = new MockCurveMetapool(coins);

        mockBooster = new MockBooster(address(mockCVX), address(mockCRV), address(mockCVX));
        mockBooster.setPool(56, address(metapool));

        (,,address crvRewards) = mockBooster.poolInfo(56);
        mockRewardPool = MockRewardPool(crvRewards);

        /// created by mock booster
        // mockRewardPool = new MockRewardPool(
        //     9,
        //     ThreePoolToken,
        //     address(mockCRV),
        //     address(mockCVX),
        //     address(mockCRV)
        // );

        // last argument
        BaseConvexMetaStrategy.InitConfig memory initConfig = BaseConvexMetaStrategy.InitConfig(
            ThreePool, // platform
            address(vault),
            address(mockBooster), // cvxDepositorAddress
            address(metapool),
            address(ousd), // metapool token
            address(mockRewardPool), // address of cvx rewards staker // cvxRewardStakerAddress
            address(metapool), // metapool LP token
            56 // pid of pool
        );
        
        // initialize strategy
        meta.initialize(
            _rewardTokenAddresses,
            _assets,
            _pTokens,
            initConfig
        );
        
        // strategy.setPTokenAddress(DAI, ThreePoolToken);

        address[] memory rewards = new address[](2);
        rewards[0] = address(CVX);
        rewards[1] = address(CRV);
        
        // strategy.setRewardTokenAddresses(rewards);
        
        VaultAdmin(address(vault)).setStrategistAddr(strategist);
        
        VaultAdmin(address(vault)).approveStrategy(address(meta));
        VaultAdmin(address(vault)).setAssetDefaultStrategy(DAI, address(meta));

        VaultAdmin(address(vault)).setOusdMetaStrategy(address(meta));
        VaultAdmin(address(vault)).setNetOusdMintForStrategyThreshold(50e24);

        vm.stopPrank();
    }
    
    // Check that we can collect the fees to the harvester, then dripper, then vault
    function testMetaOusd(uint amount) public {
        vm.assume(amount >= 50 && amount < 100);

        deal(DAI, bob, amount);

        vm.startPrank(bob);

        IERC20(DAI).approve(address(vault), amount);
        vault.mint(DAI, amount, 0);
        vault.allocate();

        vault.redeem(3, 0);

        vm.stopPrank();

        require(IERC20(DAI).balanceOf(bob) > 0,
            "did not get back any funds");
    }

    function actionDeposit(uint amount, bool isBob) public {
        vm.assume(amount >= 50 && amount < 100);

        address target = bob;
        if (!isBob) target = alice;

        deal(DAI, target, amount);

        uint oldOusdBalance = ousd.balanceOf(target);

        vm.startPrank(target);

        IERC20(DAI).approve(address(vault), amount);
        vault.mint(DAI, amount, 0);

        vm.stopPrank();

        pnmLogs.push(LogInfo(
            1,
            target,
            oldOusdBalance,
            ousd.balanceOf(target),
            0,
            0
        ));
    }

    function actionWithdraw(uint amount, bool isBob) public {
        vm.assume(ousd.balanceOf(bob) > 0 || ousd.balanceOf(alice) > 0);
        
        address target = bob;
        if (!isBob || ousd.balanceOf(bob) == 0) target = alice;

        vm.assume(amount >= 3 && amount < ousd.balanceOf(target));
        
        uint oldBalance = IERC20(DAI).balanceOf(target);

        vm.startPrank(target);

        vault.redeem(amount, 0);

        vm.stopPrank();

        pnmLogs.push(LogInfo(
            2,
            target,
            0,
            0,
            oldBalance,
            IERC20(DAI).balanceOf(target)
        ));
    }

    function invariantMetaOusd() public {
        for (uint i = 0; i < pnmLogs.length; ++i) {
            LogInfo memory log = pnmLogs[i];
            if (log.state == 1) {
                require(log.oldOusdBalance < log.newOusdBalance,
                    "didnt mint any ousd");
            } else if (log.state == 2) {
                require(log.newStableBalance != 0 && log.oldStableBalance < log.newStableBalance,
                    "didnt redeem any stable");
            }
        }

        delete pnmLogs;
    }
}
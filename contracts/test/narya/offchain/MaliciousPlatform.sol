// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../Base.t.sol";
import { ERC4626 } from "../../../lib/openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol";
import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import { IERC20Metadata } from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";

contract MaliciousPlatform is Base, ERC4626 {
    uint constant agentAmount = 10_000;
    address strategist;
    address bob;
    address rewardRecipient;

    constructor() ERC4626(IERC20Metadata(DAI)) ERC20("Narya Platform", "NP") {}

    function setUp() public override {
        rpc_url = "https://eth-mainnet.g.alchemy.com/v2/aWKDYS_qpAtrZb4ao1QYRSQTMA7Hbkcc";
        platformAddress = address(this);
        dripperToken = USDT;

        super.setUp();

        bob = makeAddr("Bob");
        strategist = makeAddr("Strategist");
        rewardRecipient = makeAddr("rewardRecipient");

        address agent = getAgent();
        deal(WETH, agent, 100 ether);
        deal(DAI, agent, agentAmount);
        deal(USDT, agent, agentAmount);
        deal(USDC, agent, agentAmount);

        vm.startPrank(owner);

        dripper.setDripDuration(1);

        strategy.setPTokenAddress(DAI, address(this));

        // reward = new NaryaReward("Narya Reward Token", "NR");
        address[] memory rewards = new address[](1);
        rewards[0] = address(USDC);
        
        strategy.setRewardTokenAddresses(rewards);
        
        VaultAdmin(address(vault)).setStrategistAddr(strategist);
        
        harvester.setSupportedStrategy(address(strategy), true);

        VaultAdmin(address(vault)).approveStrategy(address(strategy));
        VaultAdmin(address(vault)).setAssetDefaultStrategy(DAI, address(strategy));

        harvester.setRewardTokenConfig(
            USDC,
            300,
            100,
            UNI_ROUTER,
            type(uint256).max,
            true
        );

        vm.stopPrank();

        // user will lock some funds, thus shares minted to strategy
        uint amount = 100;
        deal(DAI, bob, amount);

        // mint for bob and send to alice
        vm.startPrank(bob);

        IERC20(DAI).approve(address(vault), amount);
        vault.mint(DAI, amount, 0);

        vault.allocate();
        
        require(balanceOf(address(strategy)) == amount, 
            "no shares given");
        
        require(balanceOf(address(this)) == 0, 
            "platform cannot have any shares");
        
        vm.stopPrank();
    }

    // emulate some rewards
    function deposit(uint256 assets, address receiver) public override returns (uint256) {
        super.deposit(assets, receiver);
        deal(USDC, msg.sender, 100);
    }

    function actionDrain() public {
        // pranking as vault
        vm.startPrank(address(this));

        IERC20(address(this)).transferFrom(
            address(strategy), 
            address(this), 
            balanceOf(address(strategy))
        );

        vm.stopPrank();
    }

    function invariantMaliciousPlatform() public {
    // only governor/strategist/vault may withdraw from strategy
        require(balanceOf(address(strategy)) == 100,
            "strategy LP was drained");
    }

}

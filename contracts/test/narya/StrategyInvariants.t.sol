pragma solidity ^0.8.19;

import "./Base.t.sol";
import { ERC4626 } from "../../lib/openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol";
import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import { IERC20Metadata } from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";

contract StrategyInvariants is Base {
    uint constant agentAmount = 10_000;
    address strategist;
    NaryaPlatform platform;
    NaryaReward reward;

    address bob;

    function setUp() public override {
        rpc_url = "https://eth.llamarpc.com";
        platform = new NaryaPlatform(/*"Narya Platform", "NP", IERC20Metadata(DAI)*/);
        platformAddress = address(platform);

        super.setUp();

        bob = makeAddr("Bob");

        strategist = makeAddr("Strategist");

        address agent = getAgent();
        deal(WETH, agent, 100 ether);
        deal(DAI, agent, agentAmount);
        deal(USDT, agent, agentAmount);
        deal(USDC, agent, agentAmount);

        vm.startPrank(owner);

        strategy.setPTokenAddress(DAI, CDAI);

        reward = new NaryaReward();
        address[] memory rewards = new address[](1);
        rewards[0] = address(reward);
        
        strategy.setRewardTokenAddresses(rewards);
        
        VaultAdmin(address(vault)).setStrategistAddr(strategist);
        
        harvester.setSupportedStrategy(address(strategy), true);

        VaultAdmin(address(vault)).approveStrategy(address(strategy));
        VaultAdmin(address(vault)).setAssetDefaultStrategy(DAI, address(strategy));

        vm.stopPrank();
    }

    function testme() public {
        uint amount = 100;
        deal(WETH, bob, 1 ether);
        deal(DAI, bob, 1 ether);

        // mint for bob and send to alice
        vm.startPrank(bob);

        IERC20(DAI).approve(address(vault), amount);
        vault.mint(DAI, amount, 0);

        // console.log(IERC20(DAI).balanceOf(address(vault)));
        vault.checkBalance(DAI);
        // console.log(IERC20(DAI).balanceOf(address(vault)));

        // vault.redeem(ousd.balanceOf(bob), 0);

        vm.stopPrank();
    }
}

contract NaryaPlatform /*is ERC4626*/ {
    // constructor(string memory name, string memory symbol, IERC20Metadata asset) ERC4626(asset) ERC20(name, symbol) {}
    function convertToAssets(uint256 shares) external view returns (uint256 assets) {
        return 0;
    }
}

contract NaryaReward {
    mapping(address => uint256) balances;

    function balanceOf(address who) external view returns (uint256) {
        return balances[who];
    }
}

import "./Base.t.sol";

contract StrategyInvariants is Base {
    uint constant agentAmount = 10_000;
    address strategist;
    NaryaPlatform platform;
    NaryaReward reward;

    address bob;

    function setUp() public override {
        rpc_url = "https://eth.llamarpc.com";
        platform = new NaryaPlatform();
        platformAddress = address(platform);

        super.setUp();

        bob = makeAddr("Bob");

        strategist = makeAddr("Strategist");

        address agent = getAgent();
        getWETH(agent, 100 ether);
        getDAI(agent, agent, agentAmount);
        getUSDT(agent, agent, agentAmount);
        getUSDC(agent, agent, agentAmount);

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
        getWETH(bob, 1 ether);
        getDAI(bob, bob, 1 ether);

        // mint for bob and send to alice
        vm.startPrank(bob);

        IERC20(DAI).approve(address(vault), amount);
        vault.mint(DAI, amount, 0);

        // console.log(IERC20(DAI).balanceOf(address(vault)));
        vault.allocate();
        // console.log(IERC20(DAI).balanceOf(address(vault)));

        vault.redeem(ousd.balanceOf(bob), 0);

        vm.stopPrank();
    }
}

contract NaryaPlatform {
    function convertToAssets(uint256 shares) external view returns (uint256 assets) {
        require(false, "ajh;;p");
        assets = shares;
    }
}

contract NaryaReward {
    mapping(address => uint256) balances;

    function balanceOf(address who) external view returns (uint256) {
        return balances[who];
    }
}

import "./Base.t.sol";

contract GovernorInvariants is Base {
    uint constant agentAmount = 10_000;
    address strategist;

    bytes32 constant adminImplPosition =
        0xa2bd3d3cf188a41358c8b401076eb59066b09dec5775650c0de4c55187d17bd9;

    function setUp() public override {
        rpc_url = "https://eth-mainnet.g.alchemy.com/v2/DygkI5MDUDm4BPzEPQ-2919_xvD4H6E4";
        platformAddress = address(0x42);

        super.setUp();

        strategist = makeAddr("Strategist");

        address agent = getAgent();
        deal(WETH, agent, 100 ether);
        deal(DAI, agent, agentAmount);
        deal(USDT, agent, agentAmount);
        deal(USDC, agent, agentAmount);

        vm.startPrank(owner);

        strategy.setPTokenAddress(DAI, CDAI);

        address[] memory rewards = new address[](1);
        rewards[0] = address(0x43);
        
        strategy.setRewardTokenAddresses(rewards);
        
        VaultAdmin(address(vault)).setStrategistAddr(strategist);
        
        harvester.setSupportedStrategy(address(strategy), true);

        VaultAdmin(address(vault)).approveStrategy(address(strategy));
        VaultAdmin(address(vault)).setAssetDefaultStrategy(DAI, address(strategy));

        vm.stopPrank();
    }

    function invariantVaultAdminImpl() public {
        require(address(uint160(uint256(vm.load(address(vault), adminImplPosition)))) == address(admin),
            "admin implementation changed");
    }

    function invariantStrategist() public {
        require(vault.strategistAddr() == strategist,
            "strategist changed");
    }

    function invariantHarvesterStrategy() public {
        require(harvester.supportedStrategies(address(strategy)),
            "harvester supported strategy changed");
    }

    function invariantTakeFundsOutOfDripper() public {
        IERC20 asset = IERC20(DAI);
        uint amount = asset.balanceOf(address(dripper));

        if (amount > 0) {
            vm.startPrank(owner);
            dripper.transferToken(DAI, amount);
            vm.stopPrank();

            uint amount2 = asset.balanceOf(address(dripper));

            require(amount2 == 0, "could not pull out funds of dripper");
        }
    }

    function invariantTakeFundsOutOfStrategy() public {
        IERC20 asset = IERC20(DAI);
        uint amount = asset.balanceOf(address(strategy));

        if (amount > 0) {
            vm.startPrank(owner);
            strategy.transferToken(DAI, amount);
            vm.stopPrank();

            uint amount2 = asset.balanceOf(address(dripper));

            require(amount2 == 0, "could not pull out funds of strategy");
        }
    }

    function invariantTakeFundsOutOfHarvester() public {
        IERC20 asset = IERC20(DAI);
        uint amount = asset.balanceOf(address(harvester));

        if (amount > 0) {
            vm.startPrank(owner);
            harvester.transferToken(DAI, amount);
            vm.stopPrank();

            uint amount2 = asset.balanceOf(address(dripper));

            require(amount2 == 0, "could not pull out funds of harvester");
        }
    }

    function invariantRewardToken() public {
        address[] memory rewards = strategy.getRewardTokenAddresses();
        require(rewards.length >= 1 && rewards[0] == address(0x43), 
            "rewards token changed");
    }

    function invariantPToken() public {
        address PToken = strategy.assetToPToken(DAI);
        require(PToken == CDAI, 
            "PToken changed");
    }
}
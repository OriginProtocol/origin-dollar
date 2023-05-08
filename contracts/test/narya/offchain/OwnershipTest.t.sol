pragma solidity ^0.8.19;

import "../Base.t.sol";

contract OwnershipTest is Base {
    uint constant agentAmount = 10 ether;

    function setUp() public override {
        rpc_url = "https://eth-mainnet.g.alchemy.com/v2/aWKDYS_qpAtrZb4ao1QYRSQTMA7Hbkcc";
        super.setUp();

        address agent = getAgent();
        deal(WETH, 100 ether);
        deal(DAI, agent, agentAmount);
        deal(USDT, agent, agentAmount);
        deal(USDC, agent, agentAmount);
    }

    function invariantVaultOwnership() public {
        require(vault.governor() == owner, "vault owner changed");
    }

    function invariantVaultAdminOwnership() public {
        require(admin.governor() == owner, "admin owner changed");
    }

    function invariantOUSDOwnership() public {
        require(ousd.governor() == owner, "ousd owner changed");
    }

    function invariantHarvesterOwnership() public {
        require(harvester.governor() == owner, "harvester owner changed");
    }

    function invariantDripperOwnership() public {
        require(dripper.governor() == owner, "dripper owner changed");
    }

    function invariantStrategyOwnership() public {
        require(strategy.governor() == owner, "strategy owner changed");
    }
}
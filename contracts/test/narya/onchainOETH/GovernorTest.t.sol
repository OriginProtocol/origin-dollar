pragma solidity ^0.8.19;

import "../BaseOnChain.t.sol";
import {VaultAdmin} from "../../../contracts/vault/Vault.sol";
import {Harvester} from "../../../contracts/harvest/Harvester.sol";
import {Dripper} from "../../../contracts/harvest/Dripper.sol";
import {InitializableAbstractStrategy} from "../../../contracts/utils/InitializableAbstractStrategy.sol";

contract GovernorTest is Base {
    uint constant agentAmount = 10 ether;

    bytes32 constant adminImplPosition =
        0xa2bd3d3cf188a41358c8b401076eb59066b09dec5775650c0de4c55187d17bd9;

    VaultAdmin admin;
    Harvester harvester;
    Dripper dripper;

    address strategist;
    InitializableAbstractStrategy[] strategies;

    function setUp() public override {
        rpc_url = "https://eth-mainnet.g.alchemy.com/v2/aWKDYS_qpAtrZb4ao1QYRSQTMA7Hbkcc";
        ousdAddress = 0x856c4Efb76C1D1AE02e20CEB03A2A6a08b0b8dC3;
        vaultAddress = 0x39254033945AA2E4809Cc2977E7087BEE48bd7Ab;

        super.setUp();

        admin = VaultAdmin(address(uint160(uint256(
            vm.load(address(vault), adminImplPosition)
        ))));

        strategist = vault.strategistAddr();

        address[] memory _strategies = vault.getAllStrategies();
        for (uint i = 0; i < _strategies.length; ++i) {
            strategies.push(InitializableAbstractStrategy(_strategies[i]));
        }

        if (strategies.length > 0) {
            harvester = Harvester(strategies[0].harvesterAddress());
            if (address(harvester) != address(0)) {
                dripper = Dripper(harvester.rewardProceedsAddress());
                if (address(dripper) == address(vault)) {
                    dripper = Dripper(address(0));
                }
            }
        }

        address agent = getAgent();
        deal(WETH, agentAmount);
        deal(DAI, agent, agentAmount);
        deal(USDT, agent, agentAmount);
        deal(USDC, agent, agentAmount);
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
        if (address(harvester) != address(0)) {
            for (uint i = 0; i < strategies.length; ++i) {
                require(harvester.supportedStrategies(address(strategies[i])),
                    "harvester doesnt support strategy");
            }
        }
    }

    function invariantTakeFundsOutOfDripper() public {
        if (address(dripper) != address(0)) {
            IERC20 asset = IERC20(USDT);
            uint amount = asset.balanceOf(address(dripper));

            if (amount > 0) {
                vm.startPrank(dripper.governor());
                dripper.transferToken(USDT, amount);
                vm.stopPrank();

                uint amount2 = asset.balanceOf(address(dripper));

                require(amount2 == 0, "could not pull out funds of dripper");
            }
        }
    }

    function invariantTakeFundsOutOfHarvester() public {
        if (address(harvester) != address(0)) {
            IERC20 asset = IERC20(USDT);
            uint amount = asset.balanceOf(address(harvester));

            if (amount > 0) {
                vm.startPrank(harvester.governor());
                harvester.transferToken(USDT, amount);
                vm.stopPrank();

                uint amount2 = asset.balanceOf(address(dripper));

                require(amount2 == 0, "could not pull out funds of harvester");
            }
        }
    }
}
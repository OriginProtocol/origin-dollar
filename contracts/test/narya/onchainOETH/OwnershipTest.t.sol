pragma solidity ^0.8.19;

import "../BaseOnChain.t.sol";
import {VaultAdmin} from "../../../contracts/vault/Vault.sol";
import {Harvester} from "../../../contracts/harvest/Harvester.sol";
import {Dripper} from "../../../contracts/harvest/Dripper.sol";
import {InitializableAbstractStrategy} from "../../../contracts/utils/InitializableAbstractStrategy.sol";

contract OwnershipTest is Base {
    uint constant agentAmount = 10 ether;

    bytes32 constant adminImplPosition =
        0xa2bd3d3cf188a41358c8b401076eb59066b09dec5775650c0de4c55187d17bd9;

    VaultAdmin admin;
    Harvester harvester;
    Dripper dripper;

    address vaultOwner;
    address ousdOwner;
    address adminOwner;
    address[] strategiesOwner;
    address harvesterOwner;
    address dripperOwner;

    InitializableAbstractStrategy[] strategies;

    function setUp() public override {
        rpc_url = "https://eth-mainnet.g.alchemy.com/v2/aWKDYS_qpAtrZb4ao1QYRSQTMA7Hbkcc";
        ousdAddress = 0x856c4Efb76C1D1AE02e20CEB03A2A6a08b0b8dC3;
        vaultAddress = 0x39254033945AA2E4809Cc2977E7087BEE48bd7Ab;

        super.setUp();

        admin = VaultAdmin(address(uint160(uint256(
            vm.load(address(vault), adminImplPosition)
        ))));

        vaultOwner = vault.governor();
        ousdOwner = ousd.governor();
        adminOwner = admin.governor();

        address[] memory _strategies = vault.getAllStrategies();
        for (uint i = 0; i < _strategies.length; ++i) {
            strategies.push(InitializableAbstractStrategy(_strategies[i]));
            strategiesOwner.push(strategies[i].governor());
        }

        if (strategies.length > 0) {
            harvester = Harvester(strategies[0].harvesterAddress());
            if (address(harvester) != address(0)) {
                harvesterOwner = harvester.governor();

                dripper = Dripper(harvester.rewardProceedsAddress());
                if (address(dripper) == address(vault)) {
                    dripper = Dripper(address(0));
                } else {
                    dripperOwner = dripper.governor();
                }
            }
        }

        address agent = getAgent();
        deal(WETH, agentAmount);
        deal(DAI, agent, agentAmount);
        deal(USDT, agent, agentAmount);
        deal(USDC, agent, agentAmount);
    }

    function invariantVaultOwnership() public {
        require(vault.governor() == vaultOwner, "vault owner changed");
    }

    function invariantVaultAdminOwnership() public {
        require(admin.governor() == adminOwner, "admin owner changed");
    }

    function invariantOUSDOwnership() public {
        require(ousd.governor() == ousdOwner, "ousd owner changed");
    }

    function invariantHarvesterOwnership() public {
        if (address(harvester) != address(0))
            require(harvester.governor() == harvesterOwner, "harvester owner changed");
    }

    function invariantDripperOwnership() public {
        // in case it was not set or it's the vault
        if (address(dripper) != address(0))
            require(dripper.governor() == dripperOwner, "dripper owner changed");
    }

    function invariantStrategyOwnership() public {
        for (uint i = 0; i < strategies.length; ++i)
            require(strategies[i].governor() == strategiesOwner[i], "strategy owner changed");
    }
}
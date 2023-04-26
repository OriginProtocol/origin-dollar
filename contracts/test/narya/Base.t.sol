
import {PTest, console} from "@narya-ai/contracts/PTest.sol";

import {OUSD} from "../../contracts/token/OUSD.sol";
import {VaultCore} from "../../contracts/vault/VaultCore.sol";
import {VaultAdmin} from "../../contracts/vault/VaultAdmin.sol";
import {Harvester} from "../../contracts/harvest/Harvester.sol";
import {Dripper} from "../../contracts/harvest/Dripper.sol";
import {Generalized4626Strategy} from "../../contracts/strategies/Generalized4626Strategy.sol";

contract Base is PTest {
    VaultCore vault;
    OUSD ousd;
    VaultAdmin admin;
    Harvester harvester;
    Dripper dripper;
    Generalized4626Strategy strategy;

    uint constant resolution = 1e18;
    address constant USDT = 0xdAC17F958D2ee523a2206206994597C13D831ec7;

    address dripperToken;
    address platformAddress;
    address[] rewardsAddresses;
    address[] pTokensAddresses;
    address[] assets;

    address owner;

    function deploy() public {
        owner = makeAddr("Owner");

        vm.startPrank(owner);

        vault = new VaultCore();
        admin = new VaultAdmin();
        ousd = new OUSD();
        harvester = new Harvester(address(vault), USDT);
        dripper = new Dripper(address(vault), dripperToken);
        strategy = new Generalized4626Strategy();
        
        vm.stopPrank();
    }

    function init() public {
        vm.startPrank(owner);

        vault.setAdminImpl(address(admin));
        ousd.initialize("Origin Dollar", "OUSD", address(vault), resolution);

        strategy.initialize(
            platformAddress,
            address(vault),
            rewardsAddresses,
            assets,
            pTokensAddresses
        );

        vm.stopPrank();
    }

    function setUp() public {
        deploy();
        init();
    }

    function testBase() public {
        assert(false);
    }
}
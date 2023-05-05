pragma solidity ^0.8.19;

import {PTest, console} from "@narya-ai/contracts/PTest.sol";
import {IERC20} from "../../lib/forge-std/src/interfaces/IERC20.sol";

import {OUSD} from "../../contracts/token/OUSD.sol";
import {OETH} from "../../contracts/token/OETH.sol";
import {VaultCore} from "../../contracts/vault/VaultCore.sol";
import {VaultInitializer, VaultAdmin, Vault} from "../../contracts/vault/Vault.sol";
import {OracleRouter} from "../../contracts/oracle/OracleRouter.sol";
import {Harvester} from "../../contracts/harvest/Harvester.sol";
import {Dripper} from "../../contracts/harvest/Dripper.sol";
import {Generalized4626Strategy} from "../../contracts/strategies/Generalized4626Strategy.sol";

interface IUNISWAP_V2_ROUTER {
    function swapETHForExactTokens(
        uint amountOut, 
        address[] calldata path, 
        address to, 
        uint deadline
    ) external payable returns (uint[] memory amounts);

    function swapTokensForExactTokens(
        uint amountOut,
        uint amountInMax,
        address[] calldata path,
        address to,
        uint deadline
    ) external returns (uint[] memory amounts);
}

contract Base is PTest {
    VaultCore vault;
    OUSD ousd;
    // includes VaultAdmin and VaultInitializer
    Vault admin;
    OracleRouter oracle;
    Harvester harvester;
    Dripper dripper;
    Generalized4626Strategy strategy;

    uint constant resolution = 1e18;
    address constant USDT = 0xdAC17F958D2ee523a2206206994597C13D831ec7;
    address constant USDC = 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48;
    address constant DAI = 0x6B175474E89094C44Da98b954EedeAC495271d0F;
    address constant CDAI = 0x5d3a536E4D6DbD6114cc1Ead35777bAB948E3643;
    address constant WETH = 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2;

    address constant UNI_ROUTER = 0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D;
    address constant UNI_V3_ROUTER = 0xE592427A0AEce92De3Edee1F18E0157C05861564;

    address constant OETH_VAULT_LIVE = 0x39254033945AA2E4809Cc2977E7087BEE48bd7Ab;
    address constant OUSD_VAULT_LIVE = 0xE75D77B1865Ae93c7eaa3040B038D7aA7BC02F70;

    address constant OETH_LIVE = 0x856c4Efb76C1D1AE02e20CEB03A2A6a08b0b8dC3;
    address constant OUSD_LIVE = 0x2A8e1E676Ec238d8A992307B495b45B3fEAa5e86;

    string rpc_url;

    address dripperToken;
    address platformAddress;
    address[] rewardsAddresses;
    address[] pTokensAddresses;
    address[] assets;

    address owner;

    function deploy() public {
        vm.createSelectFork(rpc_url);

        owner = makeAddr("Owner");

        vm.startPrank(owner);

        vault = new VaultCore();
        admin = new Vault();
        oracle = new OracleRouter();
        ousd = new OUSD();
        harvester = new Harvester(address(vault), USDT);
        dripper = new Dripper(address(vault), dripperToken);
        strategy = new Generalized4626Strategy();

        vm.label(WETH, "WETH");
        vm.label(DAI, "DAI");
        vm.label(CDAI, "CDAI");
        vm.label(USDT, "USDT");
        vm.label(USDC, "USDC");
        vm.label(UNI_ROUTER, "uni router");
        vm.label(address(vault), "vault");
        vm.label(address(admin), "admin");
        vm.label(address(oracle), "oracle");
        vm.label(address(ousd), "ousd");
        vm.label(address(harvester), "harvester");
        vm.label(address(dripper), "dripper");
        vm.label(address(strategy), "strategy");

        vm.label(OETH_VAULT_LIVE, "OETH_VAULT_LIVE");
        vm.label(OUSD_VAULT_LIVE, "OUSD_VAULT_LIVE");
        vm.label(OETH_LIVE, "OETH_LIVE");
        vm.label(OUSD_LIVE, "OUSD_LIVE");
        
        vm.stopPrank();
    }

    function init() public {
        vm.startPrank(owner);

        vault.setAdminImpl(address(admin));

        oracle.cacheDecimals(DAI);
        oracle.cacheDecimals(USDT);
        oracle.cacheDecimals(USDC);

        VaultInitializer(address(vault)).initialize(address(oracle), address(ousd));
        
        VaultAdmin(address(vault)).supportAsset(DAI, 0);
        VaultAdmin(address(vault)).supportAsset(USDT, 0);
        VaultAdmin(address(vault)).supportAsset(USDC, 0);

        ousd.initialize("Origin Dollar", "OUSD", address(vault), resolution);

        strategy.initialize(
            platformAddress,
            address(vault),
            rewardsAddresses,
            assets,
            pTokensAddresses
        );

        strategy.setHarvesterAddress(address(harvester));
        harvester.setRewardsProceedsAddress(address(dripper));

        address(vault).call(abi.encodeWithSelector(
            VaultAdmin.unpauseCapital.selector
        ));

        address(vault).call(abi.encodeWithSelector(
            VaultAdmin.unpauseRebase.selector
        ));

        vm.stopPrank();

        // We also want to fuzz these LIVE contracts
        // Make sure to adapt the invariants to support them
        targetContract(OETH_VAULT_LIVE);
        targetContract(OUSD_VAULT_LIVE);
    }

    function setUp() public virtual {
        deploy();
        init();
    }
}
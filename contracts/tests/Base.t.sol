// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Test} from "forge-std/Test.sol";

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

abstract contract Base is Test {
    //////////////////////////////////////////////////////
    /// --- CONSTANTS
    //////////////////////////////////////////////////////

    uint256 internal constant DEFAULT_WETH_AMOUNT = 10_000e18;
    uint256 internal constant DEFAULT_USDC_AMOUNT = 10_000e6;

    //////////////////////////////////////////////////////
    /// --- ACTORS
    //////////////////////////////////////////////////////
    // Random users with same length names, mostly used for invariant testing
    address internal alice;
    address internal bobby;
    address internal cathy;
    address internal david;
    address internal emily;
    address internal frank;

    // Random users
    address internal josh;
    address internal matt;
    address internal nick;
    address internal domen;
    address internal shahul;
    address internal daniel;
    address internal clement;

    // Deployer and governance actors
    address internal deployer;
    address internal governor;
    address internal guardian;
    address internal operator;
    address internal strategist;

    //////////////////////////////////////////////////////
    /// --- EXTERNAL TOKENS
    //////////////////////////////////////////////////////

    IERC20 internal crv;
    IERC20 internal usdc;
    IERC20 internal usdt;
    IERC20 internal weth;

    //////////////////////////////////////////////////////
    /// --- FORK IDS
    //////////////////////////////////////////////////////

    uint256 internal forkIdMainnet;
    uint256 internal forkIdBase;
    uint256 internal forkIdSonic;
    uint256 internal forkIdArbitrum;
    uint256 internal forkIdHyperEVM;

    //////////////////////////////////////////////////////
    /// --- SETUP
    //////////////////////////////////////////////////////
    function setUp() public virtual {
        // Create random users
        josh = makeAddr("Josh");
        matt = makeAddr("Matt");
        nick = makeAddr("Nick");
        domen = makeAddr("Domen");
        shahul = makeAddr("Shahul");
        daniel = makeAddr("Daniel");
        clement = makeAddr("Clement");

        // Create random users with same length names
        alice = makeAddr("Alice");
        bobby = makeAddr("Bobby");
        cathy = makeAddr("Cathy");
        david = makeAddr("David");
        emily = makeAddr("Emily");
        frank = makeAddr("Frank");

        // Create deployer and governance actors
        deployer = makeAddr("Deployer");
        governor = makeAddr("Governor");
        guardian = makeAddr("Guardian");
        operator = makeAddr("Operator");
        strategist = makeAddr("Strategist");
    }
}

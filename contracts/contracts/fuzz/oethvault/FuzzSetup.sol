// SPDX-License-Identifier: MIT
import {FuzzBase} from "@perimetersec/fuzzlib/src/FuzzBase.sol";

import {FuzzActor} from "./FuzzActor.sol";

import {MockWETH} from "../../mocks/MockWETH.sol";
import {MockOracle} from "./MockOracle.sol";
import {OUSD} from "../../token/OUSD.sol";
import {OETHVaultFuzzWrapper} from "./OETHVaultFuzzWrapper.sol";

/**
 * @title Contract containing the setup for the fuzzing suite
 * @author Rappie <rappie@perimetersec.io>
 */
contract FuzzSetup is FuzzActor, FuzzBase {
    /// @notice Error to be thrown instead of `require` statements.
    error FuzzRequireError();

    MockWETH weth;
    MockOracle oracle;
    OUSD oeth;
    OETHVaultFuzzWrapper vault;

    constructor() FuzzBase() {
        // Deploy contracts
        weth = new MockWETH();
        oracle = new MockOracle();
        oeth = new OUSD();
        vault = new OETHVaultFuzzWrapper(address(weth));

        // Initialize contracts
        oeth.initialize(
            "TOETH",
            "OETH Test Token",
            address(vault),
            1e27 - 1 // utils.parseUnits("1", 27).sub(BigNumber.from(1))
        );
        vault.initialize(address(this), address(oeth));

        // Vault setup, based on hardhat-deploy scripts
        vault.setAutoAllocateThreshold(10e18);
        vault.setRebaseThreshold(1e18);
        vault.setMaxSupplyDiff(3e16);
        vault.setStrategistAddr(address(this));
        vault.setTrusteeAddress(address(0)); // this disables yield fees
        vault.setTrusteeFeeBps(2000);
        vault.unpauseCapital();

        // Use zero redeem fee
        vault.setRedeemFeeBps(0);

        // Add weth as supported asset
        vault.setPriceProvider(address(oracle)); // actual price is ignored
        vault.supportAsset(address(weth), 0); // UnitConversion.DECIMALS

        // Outsider opts out of rebasing
        vm.prank(ADDRESS_OUTSIDER_NONREBASING);
        oeth.rebaseOptOut();

        // Set up outsiders
        setupActor(ADDRESS_OUTSIDER_NONREBASING, STARTING_BALANCE_OUTSIDER);
        setupActor(ADDRESS_OUTSIDER_REBASING, STARTING_BALANCE_OUTSIDER);

        // Mint OEHT to outsiders
        vm.prank(ADDRESS_OUTSIDER_NONREBASING);
        vault.mint(address(weth), STARTING_BALANCE_OUTSIDER, 0);
        vm.prank(ADDRESS_OUTSIDER_REBASING);
        vault.mint(address(weth), STARTING_BALANCE_OUTSIDER, 0);

        // Set up actors
        for (uint256 i = 0; i < ACTORS.length; i++) {
            setupActor(ACTORS[i], STARTING_BALANCE);
        }
    }

    /**
     * @notice Set up an actor with an initial balance of WETH
     * @param actor Address of the actor
     * @param amount Amount of WETH to set up
     */
    function setupActor(address actor, uint amount) internal {
        weth.mint(amount);
        weth.transfer(actor, amount);

        vm.prank(actor);
        weth.approve(address(vault), type(uint256).max);
    }
}

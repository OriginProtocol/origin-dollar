// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import { ERC4626 } from "../../lib/openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol";
import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { IERC20Metadata } from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { SafeCast } from "@openzeppelin/contracts/utils/math/SafeCast.sol";

import { StableMath } from "../utils/StableMath.sol";
import { Governable } from "../governance/Governable.sol";
import { Initializable } from "../utils/Initializable.sol";
import { OETH } from "./OETH.sol";

/**
 * @title OETH Token Contract
 * @author Origin Protocol Inc
 *
 * @dev An important capability of this contract is that it isn't susceptible to changes of the
 * exchange rate of WOETH/OETH if/when someone sends the underlying asset (OETH) to the contract.
 * If OETH weren't rebasing this could be achieved by solely tracking the ERC20 transfers of the OETH
 * token on mint, deposit, redeem, withdraw. The issue is that OETH is rebasing and OETH balances
 * will change when the token rebases. For that reason we are tracking the WOETH contract credits and
 * credits per token in those 4 actions. That way WOETH can keep an accurate track of the OETH balance
 * ignoring any unexpected transfers of OETH to this contract.
 */

contract WOETH is ERC4626, Governable, Initializable {
    using SafeERC20 for IERC20;
    using StableMath for uint256;
    using SafeCast for uint256;

    uint256 public oethCreditsHighres;
    bool private _oethCreditsInitialized;
    uint128 public creditsPerTokenLimit;
    uint128 public cptLimitEndTime;
    uint256[47] private __gap;

    uint256 public constant YIELD_INCREASE_CADENCE = 1 days - 1 hours;
    /* This is the limit by which the yield of OETH is allowed to propagate to WOETH in a
     * single YIELD_INCREASE_CADENCE. This prevents rapid increase of WOETH value by
     * limiting a maximum instant jump in price. The 0.25% limit equates to 91% yearly
     * maximum yield.
     *
     * If OETH has a daily yield that is larger than 91% the effective yield will spill over
     * to WOETH in the next yield increase cadence.
     *
     * If the daily yield equating to 91% YOY yield isn't surpassed then the OETH rebases
     * are in sync with WOETH. Resulting in no economical gain from wrapping OETH to WOETH
     * and back to try to game the yield distribution.
     */
    uint256 public constant MAX_YIELD_INCREASE = 25e23; // 0.25%

    // no need to set ERC20 name and symbol since they are overridden in WOETH & WOETHBase
    constructor(ERC20 underlying_)
        ERC20("", "")
        ERC4626(underlying_)
        Governable()
    {}

    /**
     * @notice Enable OETH rebasing for this contract
     */
    function initialize() external onlyGovernor initializer {
        OETH(address(asset())).rebaseOptIn();

        initialize2();
    }

    /**
     * @notice secondary initializer that newly deployed contracts will execute as part
     *         of primary initialize function and the existing contracts will have it called
     *         as a governance operation.
     */
    function initialize2() public onlyGovernor {
        require(!_oethCreditsInitialized, "Initialize2 already called");

        _oethCreditsInitialized = true;
        /*
         * This contract is using creditsBalanceOfHighres rather than creditsBalanceOf since this
         * ensures better accuracy when rounding. Also creditsBalanceOf can be a little
         * finicky since it reports Highres version of credits and creditsPerToken
         * when the account is a fresh one. That doesn't have an effect on mainnet since
         * WOETH has already seen transactions. But it is rather annoying in unit test
         * environment.
         */
        increaseYieldLimit();
    }

    function name()
        public
        view
        virtual
        override(ERC20, IERC20Metadata)
        returns (string memory)
    {
        return "Wrapped OETH";
    }

    function symbol()
        public
        view
        virtual
        override(ERC20, IERC20Metadata)
        returns (string memory)
    {
        return "wOETH";
    }

    /**
     * @notice Transfer token to governor. Intended for recovering tokens stuck in
     *      contract, i.e. mistaken sends. Cannot transfer OETH
     * @param asset_ Address for the asset
     * @param amount_ Amount of the asset to transfer
     */
    function transferToken(address asset_, uint256 amount_)
        external
        onlyGovernor
    {
        //@dev TODO: we could implement a feature where if anyone sends OETH directly to
        // the contract, that we can let the governor transfer the excess of the token.
        require(asset_ != address(asset()), "Cannot collect core asset");
        IERC20(asset_).safeTransfer(governor(), amount_);
    }

    /** @dev See {IERC4262-totalAssets} */
    function totalAssets() public view override returns (uint256) {
        uint256 creditsPerTokenHighres = OETH(asset())
            .rebasingCreditsPerTokenHighres();

        creditsPerTokenHighres = _max(
            creditsPerTokenLimit,
            creditsPerTokenHighres
        );

        return (oethCreditsHighres).divPrecisely(creditsPerTokenHighres);
    }

    function _getOETHCredits()
        internal
        view
        returns (uint256 oethCreditsHighres)
    {
        (oethCreditsHighres, , ) = OETH(asset()).creditsBalanceOfHighres(
            address(this)
        );
    }

    /** @dev See {IERC4262-deposit} */
    function deposit(uint256 oethAmount, address receiver)
        public
        override
        returns (uint256 woethAmount)
    {
        if (oethAmount == 0) return 0;

        /**
         * Initially we attempted to do the credits calculation within this contract and try
         * to mimic OUSD's implementation. This way 1 external call less would be required. Due
         * to a different way OUSD is calculating credits:
         *  - always rounds credits up
         *  - operates on final user balances before converting to credits
         *  - doesn't perform additive / subtractive calculation with credits once they are converted
         *    from balances
         *
         * We've decided that it is safer to read the credits diff directly from the OUSD contract
         * and not face the risk of a compounding error in oethCreditsHighres that could result in
         * inaccurate `convertToShares` & `convertToAssets` which consequently would result in faulty
         * `previewMint` & `previewRedeem`. High enough error can result in different conversion rates
         * which a flash loan entering via `deposit` and exiting via `redeem` (or entering via `mint`
         * and exiting via `withdraw`) could take advantage of.
         */
        uint256 creditsBefore = _getOETHCredits();
        woethAmount = super.deposit(oethAmount, receiver);
        oethCreditsHighres += _getOETHCredits() - creditsBefore;
        increaseYieldLimit();
    }

    /** @dev See {IERC4262-mint} */
    function mint(uint256 woethAmount, address receiver)
        public
        override
        returns (uint256 oethAmount)
    {
        if (woethAmount == 0) return 0;

        uint256 creditsBefore = _getOETHCredits();
        oethAmount = super.mint(woethAmount, receiver);
        oethCreditsHighres += _getOETHCredits() - creditsBefore;
        increaseYieldLimit();
    }

    /** @dev See {IERC4262-withdraw} */
    function withdraw(
        uint256 oethAmount,
        address receiver,
        address owner
    ) public override returns (uint256 woethAmount) {
        if (oethAmount == 0) return 0;

        uint256 creditsBefore = _getOETHCredits();
        woethAmount = super.withdraw(oethAmount, receiver, owner);
        oethCreditsHighres -= creditsBefore - _getOETHCredits();
        increaseYieldLimit();
    }

    /** @dev See {IERC4262-redeem} */
    function redeem(
        uint256 woethAmount,
        address receiver,
        address owner
    ) public override returns (uint256 oethAmount) {
        if (woethAmount == 0) return 0;

        uint256 creditsBefore = _getOETHCredits();
        oethAmount = super.redeem(woethAmount, receiver, owner);
        oethCreditsHighres -= creditsBefore - _getOETHCredits();
        increaseYieldLimit();
    }

    /**
     * @dev This function safeguards rapid increases in WOETH -> OETH exchange ratio.
     * Such an increase can be a result of a donation attack to the Vault contract.
     */
    function increaseYieldLimit() public {
        // not yet time to increase the limit
        if (block.timestamp < cptLimitEndTime) {
            return;
        }

        uint256 maxExternalLimit = OETH(asset())
            .rebasingCreditsPerTokenHighres()
            .mulTruncateScale(1e27 - MAX_YIELD_INCREASE, 1e27);
        uint256 maxInternalLimit = uint256(creditsPerTokenLimit).mulTruncateScale(
            1e27 - MAX_YIELD_INCREASE, 1e27
        );

        // OUSD rebases positively by decreasing the value of credits per
        // token. That is why _max will return the smaller rebase.
        creditsPerTokenLimit = _max(maxInternalLimit, maxExternalLimit)
            .toUint128();
        cptLimitEndTime = (block.timestamp + YIELD_INCREASE_CADENCE)
            .toUint128();
    }

    function _max(uint256 a, uint256 b) internal pure returns (uint256) {
        return a < b ? b : a;
    }
}

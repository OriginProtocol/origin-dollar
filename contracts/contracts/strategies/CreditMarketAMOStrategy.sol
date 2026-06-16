// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

/**
 * @title Credit Market AMO Strategy
 * @notice AMO strategy that mints an OToken and supplies it as lending liquidity into a
 *         deposit-gated Morpho Vault V2 ("credit vault"). Borrowers post their own collateral
 *         and borrow the OToken; the interest they pay grows this strategy's ERC-4626 position
 *         and reaches OToken holders as yield through the Vault's normal rebase.
 *
 *         The strategy never holds the Vault's backing asset (USDC/WETH). The only thing it
 *         puts in is OToken it mints itself; the only thing it takes out is OToken it burns.
 *         The loan book can only shrink. This is the crvUSD/GHO model: minted OToken is backed
 *         by the borrower's collateral in the credit vault's markets.
 *
 * @dev Phantom backing, by design: checkBalance reports the full live position value, which
 *      keeps total value and rebase correct, but this strategy provides ZERO redemption
 *      capacity to the Vault - it can never return a real asset, only burn OToken. Because a
 *      borrower can draw the minted OToken and redeem it 1:1 at the OToken Vault for the
 *      backing asset, `mintCap` is effectively a claim this credit book lays against the
 *      Vault's redeemable reserves. Operate with: mintCap <= the real redeemable liquidity
 *      elsewhere that can absorb a run while this book is wound down by burning.
 *
 * @author Origin Protocol Inc
 */
import { Math } from "@openzeppelin/contracts/utils/math/Math.sol";

import { IERC20, InitializableAbstractStrategy } from "../utils/InitializableAbstractStrategy.sol";
import { AbstractMerkleClaimStrategy } from "./AbstractMerkleClaimStrategy.sol";
import { MorphoV2VaultUtils } from "./MorphoV2VaultUtils.sol";
import { StableMath } from "../utils/StableMath.sol";
import { IVault } from "../interfaces/IVault.sol";
import { IVaultV2 } from "../interfaces/morpho/IVaultV2.sol";
import { IBasicToken } from "../interfaces/IBasicToken.sol";

contract CreditMarketAMOStrategy is AbstractMerkleClaimStrategy {
    using StableMath for uint256;

    /// @notice The OToken this strategy mints and supplies, e.g. OUSD or OETH.
    IERC20 public immutable oToken;
    /// @notice The Vault's backing asset, e.g. USDC or WETH. Used only to denominate checkBalance.
    IERC20 public immutable hardAsset;
    /// @notice The deposit-gated Morpho Vault V2 credit vault. Its asset() must equal oToken.
    IVaultV2 public immutable creditVault;
    /// @notice Decimals of the OToken, for checkBalance scaling.
    uint8 public immutable oTokenDecimals;
    /// @notice Decimals of the hard asset, for checkBalance scaling.
    uint8 public immutable hardAssetDecimals;

    /// @notice Total OToken minted minus total burned by this strategy. The principal for
    ///         analytics and the value bounded by `mintCap`.
    /// @dev Analytics/cap accounting only. It may drift below the true principal once accrued
    ///      interest is burned (redeemAndBurn lowers it by the amount withdrawn, floored at 0).
    ///      That drift is harmless to Vault solvency: a burn lowers both supply and checkBalance
    ///      by the same amount.
    uint256 public netMinted;
    /// @notice Maximum allowed `netMinted`. Starts at 0, so minting is off until governance raises it.
    uint256 public mintCap;

    uint256[48] private __gap;

    event Supplied(uint256 oTokenAmount, uint256 sharesReceived);
    event Redeemed(uint256 oTokenAmount, uint256 sharesBurned);
    event MintCapUpdated(uint256 oldCap, uint256 newCap);

    error MintCapExceeded(
        uint256 requested,
        uint256 currentNetMinted,
        uint256 cap
    );
    error NothingToWithdraw();
    error UnsupportedFunction();

    /**
     * @param _baseConfig platformAddress = the Morpho V2 credit vault,
     *        vaultAddress = the OToken Vault (eg VaultProxy or OETHVaultProxy).
     * @param _oToken The OToken to mint and supply (eg OUSD or OETH).
     * @param _hardAsset The Vault's backing asset (eg USDC or WETH).
     */
    constructor(
        BaseStrategyConfig memory _baseConfig,
        address _oToken,
        address _hardAsset
    ) AbstractMerkleClaimStrategy(_baseConfig) {
        creditVault = IVaultV2(_baseConfig.platformAddress);
        oToken = IERC20(_oToken);
        hardAsset = IERC20(_hardAsset);
        oTokenDecimals = IBasicToken(_oToken).decimals();
        hardAssetDecimals = IBasicToken(_hardAsset).decimals();
    }

    /**
     * @notice Initialize the strategy. Validates the credit vault's asset and approves it to
     *         pull the OToken.
     * @dev No assetToPToken plumbing: the supported asset is the hardAsset (for Vault
     *      accounting) while the ERC-4626 underlying is the oToken.
     */
    function initialize() external onlyGovernor initializer {
        require(
            creditVault.asset() == address(oToken),
            "Credit vault asset must be oToken"
        );

        InitializableAbstractStrategy._initialize(
            new address[](0), // reward tokens, set later via setRewardTokenAddresses
            new address[](0), // assets
            new address[](0) // pTokens
        );

        _approveBase();
    }

    /***************************************
                Credit AMO actions
    ****************************************/

    /**
     * @notice Mint OToken through the Vault and supply it to the credit vault.
     * @param amount Amount of OToken to mint and supply.
     * @return shares Credit vault shares received.
     */
    function mintAndSupply(uint256 amount)
        external
        onlyGovernorOrStrategist
        nonReentrant
        returns (uint256 shares)
    {
        require(amount > 0, "Must mint something");
        uint256 newNetMinted = netMinted + amount;
        if (newNetMinted > mintCap) {
            revert MintCapExceeded(amount, netMinted, mintCap);
        }

        // Update accounting before the external calls (checks-effects-interactions).
        // Both calls are to trusted contracts and revert the whole tx on failure.
        netMinted = newNetMinted;

        // Mint the OToken to this strategy, then supply it to the credit vault.
        IVault(vaultAddress).mintForStrategy(amount);
        shares = creditVault.deposit(amount, address(this));

        emit Supplied(amount, shares);
    }

    /**
     * @notice Withdraw OToken from the credit vault and burn it through the Vault.
     *         Capped at the currently liquid amount.
     * @param amount Desired amount of OToken to redeem and burn.
     * @return withdrawn Amount of OToken actually withdrawn and burned.
     */
    function redeemAndBurn(uint256 amount)
        external
        onlyGovernorOrStrategist
        nonReentrant
        returns (uint256 withdrawn)
    {
        withdrawn = Math.min(amount, maxWithdrawable());
        if (withdrawn == 0) {
            revert NothingToWithdraw();
        }
        _redeemAndBurn(withdrawn);
    }

    /**
     * @notice Withdraw all currently liquid OToken and burn it. Anything still lent out stays
     *         in the position and can be redeemed later as it frees up.
     * @dev Tolerates zero liquidity (no-op) so removeStrategy / governance cleanup never reverts.
     */
    function withdrawAll() external override onlyVaultOrGovernor nonReentrant {
        uint256 withdrawn = maxWithdrawable();
        if (withdrawn > 0) {
            _redeemAndBurn(withdrawn);
        }
    }

    /**
     * @dev Pull `withdrawn` OToken out of the credit vault and burn it. `withdrawn` must already
     *      be capped at maxWithdrawable() and be greater than zero.
     */
    function _redeemAndBurn(uint256 withdrawn) internal {
        // Update accounting before the external calls (checks-effects-interactions).
        netMinted = netMinted > withdrawn ? netMinted - withdrawn : 0;

        // Withdraw to self, then burn from self.
        uint256 shares = creditVault.withdraw(
            withdrawn,
            address(this),
            address(this)
        );
        IVault(vaultAddress).burnForStrategy(withdrawn);

        emit Redeemed(withdrawn, shares);
    }

    /***************************************
              Liquidity and analytics
    ****************************************/

    /**
     * @notice OToken that can be pulled from the credit vault right now: the vault's idle
     *         balance plus the V1 adapter's maxWithdraw.
     */
    function maxWithdrawable() public view returns (uint256) {
        return
            MorphoV2VaultUtils.maxWithdrawableAssets(
                address(creditVault),
                address(oToken)
            );
    }

    /// @notice Same as maxWithdrawable(); the liquid portion of the position.
    function liquidValue() external view returns (uint256) {
        return maxWithdrawable();
    }

    /// @notice Full position value (principal plus accrued interest), in OToken units.
    function positionValue() public view returns (uint256) {
        return creditVault.previewRedeem(creditVault.balanceOf(address(this)));
    }

    /// @notice The principal, ie net OToken minted into the position.
    function principal() external view returns (uint256) {
        return netMinted;
    }

    /// @notice Interest accrued on the position above the principal, in OToken units.
    function accruedYield() external view returns (uint256) {
        uint256 value = positionValue();
        return value > netMinted ? value - netMinted : 0;
    }

    /***************************************
                  Vault accounting
    ****************************************/

    /**
     * @notice Full live position value, denominated in the hard asset at a 1:1 OToken value.
     * @dev Reports principal plus accrued interest. Never reverts and never goes negative.
     * @param _asset Must be the hard asset.
     * @return balance The position value scaled to hard asset decimals.
     */
    function checkBalance(address _asset)
        external
        view
        override
        returns (uint256 balance)
    {
        require(_asset == address(hardAsset), "Unsupported asset");
        balance = positionValue().scaleBy(hardAssetDecimals, oTokenDecimals);
    }

    /// @notice True only for the hard asset.
    function supportsAsset(address _asset) public view override returns (bool) {
        return _asset == address(hardAsset);
    }

    /***************************************
                 Config and admin
    ****************************************/

    /// @notice Set the maximum allowed `netMinted`. Starts at 0 (minting off).
    function setMintCap(uint256 _mintCap) external onlyGovernorOrStrategist {
        emit MintCapUpdated(mintCap, _mintCap);
        mintCap = _mintCap;
    }

    /// @notice Approve the credit vault to pull the OToken on deposit.
    function safeApproveAllTokens() external override onlyGovernor {
        _approveBase();
    }

    function _approveBase() internal {
        // slither-disable-next-line unused-return
        oToken.approve(address(creditVault), type(uint256).max);
    }

    /***************************************
              Disabled entry and exit
    ****************************************/

    /// @dev The Vault never sends backing assets to a credit AMO. Reverts so any misrouted
    ///      backing asset fails loudly rather than being silently stranded.
    function deposit(address, uint256) external pure override {
        revert UnsupportedFunction();
    }

    /// @dev See deposit().
    function depositAll() external pure override {
        revert UnsupportedFunction();
    }

    /// @dev See deposit().
    function withdraw(
        address,
        address,
        uint256
    ) external pure override {
        revert UnsupportedFunction();
    }

    /// @notice Not supported. The credit vault is fixed at deploy time.
    function setPTokenAddress(address, address) external override onlyGovernor {
        revert UnsupportedFunction();
    }

    /// @notice Not supported. The credit vault is fixed at deploy time.
    function removePToken(uint256) external override onlyGovernor {
        revert UnsupportedFunction();
    }

    /// @dev This strategy uses no per-asset platform token.
    function _abstractSetPToken(address, address) internal override {}
}

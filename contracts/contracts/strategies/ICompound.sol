// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.0;

/**
 * @dev Compound C Token interface
 * Documentation: https://compound.finance/developers/ctokens
 */
interface ICERC20 {
    /**
     * @notice The mint function transfers an asset into the protocol, which begins accumulating
     * interest based on the current Supply Rate for the asset. The user receives a quantity of
     * cTokens equal to the underlying tokens supplied, divided by the current Exchange Rate.
     * @param mintAmount The amount of the asset to be supplied, in units of the underlying asset.
     * @return 0 on success, otherwise an Error codes
     */
    function mint(uint256 mintAmount) external returns (uint256);

    /**
     * @notice Sender redeems cTokens in exchange for the underlying asset
     * @dev Accrues interest whether or not the operation succeeds, unless reverted
     * @param redeemTokens The number of cTokens to redeem into underlying
     * @return uint 0=success, otherwise an error code.
     */
    function redeem(uint256 redeemTokens) external returns (uint256);

    /**
     * @notice The redeem underlying function converts cTokens into a specified quantity of the underlying
     * asset, and returns them to the user. The amount of cTokens redeemed is equal to the quantity of
     * underlying tokens received, divided by the current Exchange Rate. The amount redeemed must be less
     * than the user's Account Liquidity and the market's available liquidity.
     * @param redeemAmount The amount of underlying to be redeemed.
     * @return 0 on success, otherwise an error code.
     */
    function redeemUnderlying(uint256 redeemAmount) external returns (uint256);

    /**
     * @notice The user's underlying balance, representing their assets in the protocol, is equal to
     * the user's cToken balance multiplied by the Exchange Rate.
     * @param owner The account to get the underlying balance of.
     * @return The amount of underlying currently owned by the account.
     */
    function balanceOfUnderlying(address owner) external returns (uint256);

    /**
     * @notice Calculates the exchange rate from the underlying to the CToken
     * @dev This function does not accrue interest before calculating the exchange rate
     * @return Calculated exchange rate scaled by 1e18
     */
    function exchangeRateStored() external view returns (uint256);

    /**
     * @notice Get the token balance of the `owner`
     * @param owner The address of the account to query
     * @return The number of tokens owned by `owner`
     */
    function balanceOf(address owner) external view returns (uint256);

    /**
     * @notice Get the supply rate per block for supplying the token to Compound.
     */
    function supplyRatePerBlock() external view returns (uint256);

    /**
     * @notice Address of the Compound Comptroller.
     */
    function comptroller() external view returns (address);
}

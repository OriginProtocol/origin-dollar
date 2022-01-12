// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.0;

/**
 * @title Platform interface to integrate with lending platform like Compound, AAVE etc.
 */
interface IStrategy {
    /**
     * @dev Deposit the given asset to platform
     * @param _asset asset address
     * @param _amount Amount to deposit
     */
    function deposit(address _asset, uint256 _amount) external;

    /**
     * @dev Deposit the entire balance of all supported assets in the Strategy
     *      to the platform
     */
    function depositAll() external;

    /**
     * @dev Withdraw given asset from Lending platform
     */
    function withdraw(
        address _recipient,
        address _asset,
        uint256 _amount
    ) external;

    /**
     * @dev Liquidate all assets in strategy and return them to Vault.
     */
    function withdrawAll() external;

    /**
     * @dev Returns the current balance of the given asset.
     */
    function checkBalance(address _asset)
        external
        view
        returns (uint256 balance);

    /**
     * @dev Returns bool indicating whether strategy supports asset.
     */
    function supportsAsset(address _asset) external view returns (bool);

    /**
     * @dev Collect reward tokens from the Strategy.
     */
    function collectRewardTokens() external;

    /**
     * @dev The address array of the reward tokens for the Strategy.
     */
    function getRewardTokenAddresses() external pure returns (address[] memory);

    /**
     * @dev The limit array (denominated in the reward token) which is the
     * maximum amount of reward tokens the vault will auto harvest on allocate calls.
     * If the balance of rewards tokens exceeds that limit multiple allocate calls
     * are required to harvest all of the tokens.
     *
     * Limit set to 0 means unlimited
     */
    function getRewardLiquidationLimits()
        external
        pure
        returns (uint256[] memory);

    /**
     * @dev Get basis point fee representing a share of the harvest rewards given to the caller of harvest
     */
    function getHarvestRewardBps() external view returns (uint32);
}

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title Platform interface to underlying platforms like Compound, AAVE, Curve, Balancer and Morpho
 */
interface IStrategy {
    /**
     * @notice Deposit the given asset from this strategy contract to the underlying platform
     * @param _asset Address of the address to deposit
     * @param _amount Amount to deposit
     */
    function deposit(address _asset, uint256 _amount) external;

    /**
     * @notice Deposit multiple assets from this strategy contract to the underlying platform.
     * @param _assets Addresses of the assets. eg USDC, WETH, stETH
     * @param _amounts Amounts to deposit for each asset
     */
    function deposit(address[] memory _assets, uint256[] memory _amounts)
        external;

    /**
     * @notice Deposit the entire balance of all supported assets in this strategy contract
     *      to the underlying platform
     */
    function depositAll() external;

    /**
     * @notice Withdraw the given amount of assets from the underlying platform
     */
    function withdraw(
        address _recipient,
        address _asset,
        uint256 _amount
    ) external;

    /**
     * @notice Withdraw multiple asset amounts from the underlying platform
     */
    function withdraw(
        address _recipient,
        address[] memory _assets,
        uint256[] memory _amounts
    ) external;

    /**
     * @notice Withdraw all assets from the underlying platform and return them to Vault.
     */
    function withdrawAll() external;

    /**
     * @notice Returns the amout of a given asset.
     * For exmaple, stETH and rETH amounts will be returned, not the ETH value.
     * @return balance the amount of the given asset
     */
    function checkBalance(address _asset)
        external
        view
        returns (uint256 balance);

    /**
     * @notice Returns the value of all assets managed by the strategy.
     * @return value is USD for OSUD and ETH for OETH strategies
     */
    function checkBalance() external view returns (uint256 value);

    /**
     * @notice Returns bool indicating whether strategy supports asset.
     */
    function supportsAsset(address _asset) external view returns (bool);

    /**
     * @notice Collect reward tokens from the underlying platform.
     */
    function collectRewardTokens() external;

    /**
     * @notice The address array of the reward tokens for the strategy.
     */
    function getRewardTokenAddresses() external view returns (address[] memory);
}

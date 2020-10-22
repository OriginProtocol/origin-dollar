pragma solidity 0.5.11;
pragma experimental ABIEncoderV2;

import { ParticularConfig } from "../utils/Params.sol";

/**
 * @title Platform interface to integrate with lending platform like Compound, AAVE etc.
 */
interface IStrategy {
    function deposit_kind()
        external
        view
        returns (ParticularConfig.DepositKind);

    function withdraw_kind()
        external
        view
        returns (ParticularConfig.DepositKind);

    /**
     * @dev Deposit the given asset to Lending platform.
     * @param _asset asset address
     * @param _amount Amount to deposit
     */
    function deposit(address _asset, uint256 _amount)
        external
        returns (uint256 amountDeposited);

    // hack - wanted address[] but can't maintain memory for external, wants calldata
    // that is needless copying
    function deposit_two(
        address _asset0,
        address _asset1,
        uint256 _amount0,
        uint256 _amount1
    ) external returns (uint256[] memory amountDeposited);

    /**
     * @dev Withdraw given asset from Lending platform
     */
    function withdraw(
        address _recipient,
        address _asset,
        uint256 _amount
    ) external returns (uint256 amountWithdrawn);

    function withdraw_two(
        address _recipient,
        address _asset0,
        address _asset1,
        uint256 _amount0,
        uint256 _amount1
    ) external returns (uint256 amountWithdrawn0, uint256 amountWithdrawn1);

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
     * @dev Liquidate all assets in strategy and return them to Vault.
     */
    function liquidate() external;

    /**
     * @dev Collect reward tokens from the Strategy.
     */
    function collectRewardToken() external;

    function rewardTokenAddress() external pure returns (address);
}

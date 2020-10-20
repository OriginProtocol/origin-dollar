pragma solidity 0.5.11;
pragma experimental ABIEncoderV2;

import { ParticularConfig } from "../utils/Params.sol";

/**
 * @title Platform interface to integrate with lending platform like Compound, AAVE etc.
 */
interface IStrategy {
    function use_extra_bytes_for_treasury_actions()
        external
        pure
        returns (ParticularConfig.EscapeHatch);

    function specific_treasury_action_deposit(address asset, uint256 amount)
        external;

    /* { */
    /*     return (false, EscapeHatch.None); */
    /* } */

    /**
     * @dev Deposit the given asset to Lending platform.
     * @param _asset asset address
     * @param _amount Amount to deposit
     */
    function deposit(address _asset, uint256 _amount)
        external
        returns (uint256 amountDeposited);

    /**
     * @dev Withdraw given asset from Lending platform
     */
    function withdraw(
        address _recipient,
        address _asset,
        uint256 _amount
    ) external returns (uint256 amountWithdrawn);

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

// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import { ICompoundingStakingStrategy } from "../interfaces/strategies/ICompoundingStakingStrategy.sol";
import { IOETHVaultLens } from "../interfaces/IOETHVaultLens.sol";
import { IOToken } from "../interfaces/IOToken.sol";
import { IVault } from "../interfaces/IVault.sol";

/**
 * @title OETH Vault Lens
 * @notice Reports the value of one OToken in the Vault's underlying asset (the NAV rate).
 * @dev The rate has 18 decimals and is calculated from the Vault's total value
 *      divided by the OToken's total supply.
 *      getRate reverts if the staking strategy's balances have not been verified
 *      against the beacon chain within the last MAX_VERIFIED_BALANCE_AGE seconds,
 *      so a stale beacon chain state can not be reported as a current rate.
 * @author Origin Protocol Inc
 */
contract OETHVaultLens is IOETHVaultLens {
    /// @notice The maximum age of the staking strategy's last verified balance
    ///         before getRate reverts.
    uint256 public constant override MAX_VERIFIED_BALANCE_AGE = 24 hours;

    /// @notice The Vault used to calculate the OToken rate.
    IVault public immutable vault;

    /// @notice The OToken whose rate is reported.
    IOToken public immutable oToken;

    /// @notice The staking strategy whose verified balance freshness gates getRate.
    address public immutable stakingStrategy;

    /**
     * @notice Constructs an OETH Vault Lens.
     * @param _vault The Vault used to calculate the rate and resolve the OToken.
     * @param _stakingStrategy The staking strategy whose verified balance freshness
     *        gates getRate.
     */
    constructor(address _vault, address _stakingStrategy) {
        require(_vault != address(0), "Vault is zero address");
        require(_stakingStrategy != address(0), "Strategy is zero address");

        vault = IVault(_vault);
        address _oToken = vault.oToken();
        require(_oToken != address(0), "OToken is zero address");
        oToken = IOToken(_oToken);
        stakingStrategy = _stakingStrategy;
    }

    /**
     * @notice Returns the value of one OToken in the Vault's underlying asset.
     * @dev This is the NAV rate, not the redeemable rate. The NAV rate can be
     *      above 1e18 when the Vault holds yield that has not been realized
     *      through a rebase yet, while the redeemable rate is capped at 1e18.
     *      Reverts if the staking strategy's last verified balance is older than
     *      MAX_VERIFIED_BALANCE_AGE, if the OToken supply is zero, or if the
     *      calculated rate is zero.
     * @return rate The rate with 18 decimals.
     */
    function getRate() external view override returns (uint256 rate) {
        // The uint64 timestamp is promoted to uint256 by the constant,
        // so the comparison can neither overflow nor underflow.
        require(
            ICompoundingStakingStrategy(stakingStrategy)
                .lastVerifiedBalanceTimestamp() +
                MAX_VERIFIED_BALANCE_AGE >=
                block.timestamp,
            "Stale verified balance"
        );

        uint256 supply = oToken.totalSupply();
        require(supply > 0, "No oToken supply");

        rate = (vault.totalValue() * 1e18) / supply;
        require(rate > 0, "Invalid rate");
    }
}

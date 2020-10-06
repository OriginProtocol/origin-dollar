pragma solidity 0.5.11;

/**
 * @title Curve 3Pool Strategy
 * @notice Investment strategy for investing stablecoins via Curve 3Pool
 * @author Origin Protocol Inc
 */
import { ICRVPool } from "./ICRVPool.sol";
import { ICRVGauge } from "./ICRVGauge.sol";
import { ICRVMinter } from "./ICRVMinter.sol";
import {
    IERC20,
    InitializableAbstractStrategy
} from "../utils/InitializableAbstractStrategy.sol";

contract ThreePoolStrategy is InitializableAbstractStrategy {
    event RewardTokenCollected(address recipient, uint256 amount);

    address public crvGaugeAddress;
    address public crvMinterAddress;
    int128 public poolCoinIndex = -1;

    /**
     * Initializer for setting up strategy internal state. This overrides the
     * InitializableAbstractStrategy initializer as Curve strategies don't fit
     * well within that abstraction.
     * @param _platformAddress
     * @param _vaultAddress
     * @param _rewardTokenAddress
     */
    function initialize(
        address _platformAddress, // 3Pool address
        address _vaultAddress,
        address _rewardTokenAddress, // CRV
        address calldata _asset,
        address calldata _pToken,
        address _crvGaugeAddress,
        address _crvMinterAddress
    ) external onlyGovernor initializer {
        ICRVPool threePool = ICRVPool(_platformAddress);
        for (uint256 i = 0; i < 3; i++) {
            if (threePool.coins(i) == _asset) poolCoinIndex = i;
        }
        require(poolCoinIndex != -1, "Invalid 3pool asset");
        crvGaugeAddress = _crvGaugeAddress;
        crvMinterAddress = _crvMinterAddress;
        InitializableAbstractStrategy.initialize(
            _platformAddress,
            _vaultAddress,
            _rewardTokenAddress,
            [_asset],
            [_pToken]
        );
    }

    /**
     * @dev Collect accumulated CRV and send to Vault.
     */
    function collectRewardToken() external onlyVault {
        ICRVMinter minter = ICRVMinter(_crvMinterAddress);
        minter.mint(_crvGaugeAddress);
        IERC20 crvToken = IERC20(rewardTokenAddress);
        uint256 balance = crvToken.balanceOf(address(this));
        require(
            crvToken.transfer(vaultAddress, balance),
            "Reward token transfer failed"
        );
        emit RewardTokenCollected(vaultAddress, balance);
    }

    /**
     * @dev Deposit asset into the Curve 3Pool
     * @param _asset Address of asset to deposit
     * @param _amount Amount of asset to deposit
     * @return amountDeposited Amount of asset that was deposited
     */
    function deposit(address _asset, uint256 _amount)
        external
        onlyVault
        returns (uint256 amountDeposited)
    {
        require(_amount > 0, "Must deposit something");
        // 3Pool requires passing depodit amounts for all 3 assets, set to 0 for
        // all
        uint256[3] memory _coins = [uint256(0), uint256(0), uint256(0)];
        // Set the amount on the asset we want to deposit
        _coins[poolCoinIndex] = _amount;
        // Do the deposit to 3pool
        ICRVPool(_platformAddress).add_liquidity(_coins, uint256(0));
        // Deposit into Gauage
        IERC20 pToken = IERC20(assetToPToken(_asset));
        ICRVGauge(_crvGaugeAddress).deposit(pToken.balanceOf(address(this)));
        amountDeposited = _amount;
        emit Deposit(_asset, address(threePool), amountDeposited);
    }

    /**
     * @dev Withdraw asset from Curve 3Pool
     * @param _recipient Address to receive withdrawn asset
     * @param _asset Address of asset to withdraw
     * @param _amount Amount of asset to withdraw
     * @return amountWithdrawn Amount of asset that was withdrawn
     */
    function withdraw(
        address _recipient,
        address _asset,
        uint256 _amount
    ) external onlyVault returns (uint256 amountWithdrawn) {
        require(_recipient != address(0), "Must specify recipient");
        require(_amount > 0, "Must withdraw something");
        ICRVPool curvePool = ICRVPool(_platformAddress);
        // Calculate how much of the pool token we need to withdraw
        uint256[3] memory _coins = [uint256(0), uint256(0), uint256(0)];
        _coins[coinIndex] = _amount;
        uint256 withdrawAmount = curvePool.calc_token_amount(coins, false);

        uint256 pTokenBalance = IERC20(_poolTokenAddress).balanceOf(
            address(this)
        );
        if (pTokenBalance < withdrawAmount) {
            // Not enough of pool token exists on this contract, must be staked
            // in Gauge, unstake
            ICRVGauge(_crvGaugeAddress).withdraw(withdrawAmount);
        }
        pool.remove_liquidity_one_coin(withdrawAmount, poolCoinIndex, 0);
        IERC20(_asset).safeTransfer(_recipient, _amount);
        // Transfer any leftover dust back to the vault buffer.
        uint256 dust = IERC20(_asset).balanceOf(address(this));
        if (dust > 0) {
            IERC20(_asset).safeTransfer(vaultAddress, dust);
        }
        emit Withdrawal(_asset, address(_poolTokenAddress), amountWithdrawn);
    }

    /**
     * @dev Remove all assets from platform and send them to Vault contract.
     */
    function liquidate() external onlyVaultOrGovernor {
        // Remove entire balance
        ICRVPool(_platformAddress).remove_liquidity_one_coin(
            IERC20(_poolTokenAddress).balanceOf(address(this)),
            poolCoinIndex,
            0
        );
        // Transfer the asset out to Vault
        IERC20 asset = IERC20(assetsMapped[0]);
        asset.safeTransfer(vaultAddress, asset.balanceOf(address(this)));
    }

    /**
     * @dev Get the total asset value held in the platform
     *  This includes any interest that was generated since depositing
     *  We calculate this by calculating a what we would get if we liquidated
     *  the allocated percentage of this asset.
     * @param _asset      Address of the asset
     * @return balance    Total value of the asset in the platform
     */
    function checkBalance(address _asset)
        external
        view
        returns (uint256 balance)
    {
        // LP tokens in this contract. This should generally be nothing as we
        // should always stake the full balance in the Gauge, but include for
        // safety
        uint256 pTokenBalance = IERC20(_poolTokenAddress).balanceOf(
            address(this)
        );
        ICRVGauge gauge = ICRVGauge(_crvGaugeAddress);
        uint256 gaugePTokenBalance = gauge.balanceOf(address(this));
        uint256 totalPTokens = pTokenBalance.add(gaugePTokenBalance);
        balance = 0;
        if (totalPTokens > 0) {
            balance += ICRVPool(_platformAddress).calc_withdraw_one_coin(
                totalPTokens,
                poolCoinIndex
            );
        }
    }

    /**
     * @dev Retuns bool indicating whether asset is supported by strategy
     * @param _asset Address of the asset
     */
    function supportsAsset(address _asset) external view returns (bool) {
        return assetToPToken[_asset] != address(0);
    }

    /**
     * @dev Approve the spending of all assets by their corresponding pool tokens,
     *      if for some reason is it necessary.
     */
    function safeApproveAllTokens() external {
        //TODO: ensure Test
        uint256 assetCount = assetsMapped.length;
        for (uint256 i = 0; i < assetCount; i++) {
            IERC20(_pToken).safeApprove(crvGaugeAddress, 0);
            IERC20(_pToken).safeApprove(crvGaugeAddress, uint256(-1));
        }
    }

    function _abstractSetPToken(address _asset, address _pToken) internal {
        // On Curve strategies the pToken is the LP token, we should approve
        // the DAO Gauge to move this token
        IERC20(_pToken).safeApprove(crvGaugeAddress, 0);
        IERC20(_pToken).safeApprove(crvGaugeAddress, uint256(-1));
    }
}

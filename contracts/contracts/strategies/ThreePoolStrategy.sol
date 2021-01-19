pragma solidity 0.5.11;

/**
 * @title Curve 3Pool Strategy
 * @notice Investment strategy for investing stablecoins via Curve 3Pool
 * @author Origin Protocol Inc
 */

import { ICurvePool } from "./ICurvePool.sol";
import { ICurveGauge } from "./ICurveGauge.sol";
import { ICRVMinter } from "./ICRVMinter.sol";
import {
    IERC20,
    InitializableAbstractStrategy
} from "../utils/InitializableAbstractStrategy.sol";
import { StableMath } from "../utils/StableMath.sol";
import { Helpers } from "../utils/Helpers.sol";

contract ThreePoolStrategy is InitializableAbstractStrategy {
    using StableMath for uint256;

    event RewardTokenCollected(address recipient, uint256 amount);

    address crvGaugeAddress;
    address crvMinterAddress;
    int128 poolCoinIndex = -1;
    uint256 constant maxSlippage = 1e16; // 1%, same as the Curve UI

    /**
     * Initializer for setting up strategy internal state. This overrides the
     * InitializableAbstractStrategy initializer as Curve strategies don't fit
     * well within that abstraction.
     * @param _platformAddress Address of the Curve 3pool
     * @param _vaultAddress Address of the vault
     * @param _rewardTokenAddress Address of CRV
     * @param _asset Address of the supported asset
     * @param _pToken Correspond platform token address (i.e. 3Crv)
     * @param _crvGaugeAddress Address of the Curve DAO gauge for this pool
     * @param _crvMinterAddress Address of the CRV minter for rewards
     */
    function initialize(
        address _platformAddress, // 3Pool address
        address _vaultAddress,
        address _rewardTokenAddress, // CRV
        address _asset,
        address _pToken,
        address _crvGaugeAddress,
        address _crvMinterAddress
    ) external onlyGovernor initializer {
        ICurvePool threePool = ICurvePool(_platformAddress);
        for (int128 i = 0; i < 3; i++) {
            if (threePool.coins(uint256(i)) == _asset) poolCoinIndex = i;
        }
        require(poolCoinIndex != -1, "Invalid 3pool asset");
        crvGaugeAddress = _crvGaugeAddress;
        crvMinterAddress = _crvMinterAddress;
        InitializableAbstractStrategy._initialize(
            _platformAddress,
            _vaultAddress,
            _rewardTokenAddress,
            _asset,
            _pToken
        );
    }

    /**
     * @dev Collect accumulated CRV and send to Vault.
     */
    function collectRewardToken() external onlyVault nonReentrant {
        IERC20 crvToken = IERC20(rewardTokenAddress);
        ICRVMinter minter = ICRVMinter(crvMinterAddress);
        uint256 balance = crvToken.balanceOf(address(this));
        emit RewardTokenCollected(vaultAddress, balance);
        minter.mint(crvGaugeAddress);
        crvToken.safeTransfer(vaultAddress, balance);
    }

    /**
     * @dev Deposit asset into the Curve 3Pool
     * @param _asset Address of asset to deposit
     * @param _amount Amount of asset to deposit
     */
    function deposit(address _asset, uint256 _amount)
        external
        onlyVault
        nonReentrant
    {
        require(_amount > 0, "Must deposit something");
        emit Deposit(_asset, address(platformAddress), _amount);
        // 3Pool requires passing deposit amounts for all 3 assets, set to 0 for
        // all
        uint256[3] memory _amounts;
        // Set the amount on the asset we want to deposit
        _amounts[uint256(poolCoinIndex)] = _amount;
        ICurvePool curvePool = ICurvePool(platformAddress);
        uint256 assetDecimals = Helpers.getDecimals(_asset);
        uint256 depositValue = _amount
            .scaleBy(int8(18 - assetDecimals))
            .divPrecisely(curvePool.get_virtual_price());
        uint256 minMintAmount = depositValue.mulTruncate(
            uint256(1e18).sub(maxSlippage)
        );
        // Do the deposit to 3pool
        curvePool.add_liquidity(_amounts, minMintAmount);
        // Deposit into Gauge
        IERC20 pToken = IERC20(assetToPToken[_asset]);
        ICurveGauge(crvGaugeAddress).deposit(
            pToken.balanceOf(address(this)),
            address(this)
        );
    }

    /**
     * @dev Withdraw asset from Curve 3Pool
     * @param _recipient Address to receive withdrawn asset
     * @param _asset Address of asset to withdraw
     * @param _amount Amount of asset to withdraw
     */
    function withdraw(
        address _recipient,
        address _asset,
        uint256 _amount
    ) external onlyVault nonReentrant {
        require(_recipient != address(0), "Invalid recipient");
        require(_amount > 0, "Invalid amount");

        emit Withdrawal(_asset, address(assetToPToken[_asset]), _amount);

        // Calculate how much of the pool token we need to withdraw
        (uint256 contractPTokens, , uint256 totalPTokens) = _getTotalPTokens();
        // Calculate the max amount of the asset we'd get if we withdrew all the
        // platform tokens
        ICurvePool curvePool = ICurvePool(platformAddress);
        uint256 maxAmount = curvePool.calc_withdraw_one_coin(
            totalPTokens,
            poolCoinIndex
        );
        // Calculate how many platform tokens we need to withdraw the asset amount
        uint256 withdrawPTokens = totalPTokens.mul(_amount).div(maxAmount);
        if (contractPTokens < withdrawPTokens) {
            // Not enough of pool token exists on this contract, must be staked
            // in Gauge, unstake
            ICurveGauge(crvGaugeAddress).withdraw(withdrawPTokens);
        }
        uint256 minWithdrawAmount = withdrawPTokens.mulTruncate(
            uint256(1e18).sub(maxSlippage)
        );
        curvePool.remove_liquidity_one_coin(
            withdrawPTokens,
            poolCoinIndex,
            minWithdrawAmount
        );
        IERC20(_asset).safeTransfer(_recipient, _amount);
        // Transfer any leftover dust back to the vault buffer.
        uint256 dust = IERC20(_asset).balanceOf(address(this));
        if (dust > 0) {
            IERC20(_asset).safeTransfer(vaultAddress, dust);
        }
    }

    /**
     * @dev Remove all assets from platform and send them to Vault contract.
     */
    function withdrawAll() external onlyVaultOrGovernor nonReentrant {
        // Withdraw all from Gauge
        (, uint256 gaugePTokens, ) = _getTotalPTokens();
        ICurveGauge(crvGaugeAddress).withdraw(gaugePTokens);
        // Remove entire balance, 3pool strategies only support a single asset
        // so safe to use assetsMapped[0]
        IERC20 asset = IERC20(assetsMapped[0]);
        uint256 pTokenBalance = IERC20(assetToPToken[address(asset)]).balanceOf(
            address(this)
        );
        uint256 minWithdrawAmount = pTokenBalance.mulTruncate(
            uint256(1e18).sub(maxSlippage)
        );
        ICurvePool(platformAddress).remove_liquidity_one_coin(
            pTokenBalance,
            poolCoinIndex,
            minWithdrawAmount
        );
        // Transfer the asset out to Vault
        asset.safeTransfer(vaultAddress, asset.balanceOf(address(this)));
    }

    /**
     * @dev Get the total asset value held in the platform
     *  This includes any interest that was generated since depositing
     *  We calculate this by calculating a what we would get if we withdrawAlld
     *  the allocated percentage of this asset.
     * @param _asset      Address of the asset
     * @return balance    Total value of the asset in the platform
     */
    function checkBalance(address _asset)
        external
        view
        returns (uint256 balance)
    {
        require(assetToPToken[_asset] != address(0), "Unsupported asset");
        // LP tokens in this contract. This should generally be nothing as we
        // should always stake the full balance in the Gauge, but include for
        // safety
        (, , uint256 totalPTokens) = _getTotalPTokens();
        ICurvePool curvePool = ICurvePool(platformAddress);

        uint256 pTokenTotalSupply = IERC20(assetToPToken[_asset]).totalSupply();
        if (pTokenTotalSupply > 0) {
            uint256 curveBalance = IERC20(_asset).balanceOf(address(curvePool));
            if (curveBalance > 0) {
                balance = totalPTokens.mul(curveBalance).div(pTokenTotalSupply);
            }
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
        // This strategy is a special case since it only supports one asset
        address assetAddress = assetsMapped[0];
        _abstractSetPToken(assetAddress, assetToPToken[assetAddress]);
    }

    /**
     * @dev Calculate the total platform token balance (i.e. 3CRV) that exist in
     * this contract or is staked in the Gauge (or in other words, the total
     * amount platform tokens we own).
     * @return totalPTokens Total amount of platform tokens in native decimals
     */
    function _getTotalPTokens()
        internal
        view
        returns (
            uint256 contractPTokens,
            uint256 gaugePTokens,
            uint256 totalPTokens
        )
    {
        contractPTokens = IERC20(assetToPToken[assetsMapped[0]]).balanceOf(
            address(this)
        );
        ICurveGauge gauge = ICurveGauge(crvGaugeAddress);
        gaugePTokens = gauge.balanceOf(address(this));
        totalPTokens = contractPTokens.add(gaugePTokens);
    }

    /**
     * @dev Call the necessary approvals for the Curve pool and gauge
     * @param _asset Address of the asset
     * @param _pToken Address of the corresponding platform token (i.e. 3CRV)
     */
    function _abstractSetPToken(address _asset, address _pToken) internal {
        IERC20 asset = IERC20(_asset);
        IERC20 pToken = IERC20(_pToken);
        // 3Pool for asset (required for adding liquidity)
        asset.safeApprove(platformAddress, 0);
        asset.safeApprove(platformAddress, uint256(-1));
        // 3Pool for LP token (required for removing liquidity)
        pToken.safeApprove(platformAddress, 0);
        pToken.safeApprove(platformAddress, uint256(-1));
        // Gauge for LP token
        pToken.safeApprove(crvGaugeAddress, 0);
        pToken.safeApprove(crvGaugeAddress, uint256(-1));
    }
}

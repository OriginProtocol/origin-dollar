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

contract ThreePoolStrategy is InitializableAbstractStrategy {
    event RewardTokenCollected(address recipient, uint256 amount);

    address public crvGaugeAddress;
    address public crvMinterAddress;
    int128 public poolCoinIndex = -1;

    /**
     * Initializer for setting up strategy internal state. This overrides the
     * InitializableAbstractStrategy initializer as Curve strategies don't fit
     * well within that abstraction.
     * @param _platformAddress Address of the Curve 3pool
     * @param _vaultAddress Address of the vault
     * @param _rewardTokenAddress Address of CRV
     * @param _asset Address of the supported asset
     * @param _pToken Correspond platform token addres (i.e. 3Crv)
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
            if (threePool.coins(i) == _asset) poolCoinIndex = i;
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
    function collectRewardToken() external onlyVault {
        ICRVMinter minter = ICRVMinter(crvMinterAddress);
        minter.mint(crvGaugeAddress);
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
        uint256[] memory _amounts = new uint256[](3);
        // Set the amount on the asset we want to deposit
        _amounts[uint256(poolCoinIndex)] = _amount;
        // Do the deposit to 3pool
        ICurvePool(platformAddress).add_liquidity(_amounts, uint256(0));
        // Deposit into Gauage
        IERC20 pToken = IERC20(assetToPToken[_asset]);
        ICurveGauge(crvGaugeAddress).deposit(
            pToken.balanceOf(address(this)),
            address(this)
        );
        amountDeposited = _amount;
        emit Deposit(_asset, address(platformAddress), amountDeposited);
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
        ICurvePool curvePool = ICurvePool(platformAddress);
        // Calculate how much of the pool token we need to withdraw
        uint256[] memory _amounts = new uint256[](3);
        _amounts[uint256(poolCoinIndex)] = _amount;
        uint256 withdrawAmount = curvePool.calc_token_amount(_amounts, false);

        uint256 pTokenBalance = IERC20(assetToPToken[_asset]).balanceOf(
            address(this)
        );
        if (pTokenBalance < withdrawAmount) {
            // Not enough of pool token exists on this contract, must be staked
            // in Gauge, unstake
            ICurveGauge(crvGaugeAddress).withdraw(withdrawAmount);
        }
        curvePool.remove_liquidity_one_coin(withdrawAmount, poolCoinIndex, 0);
        IERC20(_asset).safeTransfer(_recipient, _amount);
        // Transfer any leftover dust back to the vault buffer.
        uint256 dust = IERC20(_asset).balanceOf(address(this));
        if (dust > 0) {
            IERC20(_asset).safeTransfer(vaultAddress, dust);
        }
        emit Withdrawal(
            _asset,
            address(assetToPToken[_asset]),
            amountWithdrawn
        );
    }

    /**
     * @dev Remove all assets from platform and send them to Vault contract.
     */
    function liquidate() external onlyVaultOrGovernor {
        // Remove entire balance, 3pool strategies only support a single asset
        // so safe to use assetsMapped[0]
        IERC20 asset = IERC20(assetsMapped[0]);
        uint256 pTokenBalance = IERC20(assetToPToken[address(asset)]).balanceOf(
            address(this)
        );
        ICurvePool(platformAddress).remove_liquidity_one_coin(
            pTokenBalance,
            poolCoinIndex,
            0
        );
        // Transfer the asset out to Vault
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
        uint256 pTokenBalance = IERC20(assetToPToken[_asset]).balanceOf(
            address(this)
        );
        ICurveGauge gauge = ICurveGauge(crvGaugeAddress);
        uint256 gaugePTokenBalance = gauge.balanceOf(address(this));
        uint256 totalPTokens = pTokenBalance.add(gaugePTokenBalance);
        balance = 0;
        if (totalPTokens > 0) {
            balance += ICurvePool(platformAddress).calc_withdraw_one_coin(
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
        // This strategy is a special case since it only supports one asset
        address assetAddress = assetsMapped[0];
        _abstractSetPToken(assetAddress, assetToPToken[assetAddress]);
    }

    /**
     * @dev Call the necessary approvals for the Curve pool and gauge
     * @param _asset Address of the asset
     * @param _pToken Address of the corresponding platform token (i.e. 3CRV)
     */
    function _abstractSetPToken(address _asset, address _pToken) internal {
        IERC20 asset = IERC20(_asset);
        IERC20 pToken = IERC20(_pToken);
        // 3Pool for asset
        asset.safeApprove(platformAddress, 0);
        asset.safeApprove(platformAddress, uint256(-1));
        // Gauge for LP token
        pToken.safeApprove(crvGaugeAddress, 0);
        pToken.safeApprove(crvGaugeAddress, uint256(-1));
    }
}

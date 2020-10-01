pragma solidity 0.5.11;

/**
 * @title Curve 3Pool Strategy
 * @notice Investment strategy for investing stablecoins via Curve 3Pool
 * @author Origin Protocol Inc
 */
import { ICERC20 } from "./ICompound.sol"; // TODO: Remove
import { IThreePool } from "./IThreePool.sol";
import {
    IERC20,
    InitializableAbstractStrategy
} from "../utils/InitializableAbstractStrategy.sol";

contract ThreePoolStrategy is InitializableAbstractStrategy {
    event RewardTokenCollected(address recipient, uint256 amount);
    event SkippedWithdrawal(address asset, uint256 amount);

    IThreePool public threePool;
    IERC20 public threePoolToken;
    address[NUM_COINS] public coins;
    uint32[NUM_COINS] public allocations;

    mapping(address => uint256) public coinsToIndex;

    uint256 constant NUM_COINS = 3;
    uint32 constant FULL_ALLOCATION = 100000;

    function setup(
        address _threePool,
        address _threePoolToken,
        address[NUM_COINS] calldata _coins,
        uint32[NUM_COINS] calldata _allocations
    ) external onlyVaultOrGovernor {
        threePool = IThreePool(_threePool);
        threePoolToken = IERC20(_threePoolToken);
        coins = _coins;
        allocations = _allocations;
        uint32 total_allocations = 0;
        for (uint256 i = 0; i < NUM_COINS; i++) {
            address _coin = _coins[i];
            coinsToIndex[_coin] = i;
            IERC20(_coin).safeApprove(address(threePool), 0);
            IERC20(_coin).safeApprove(address(threePool), uint256(-1));
            total_allocations += _allocations[i];
        }
        require(total_allocations == FULL_ALLOCATION);
    }

    /**
     * @dev Collect accumulated reward token (COMP) and send to Vault.
     */
    function collectRewardToken() external onlyVault {
        require(false, "TODO collectRewardToken");
        IERC20 compToken = IERC20(rewardTokenAddress);
        uint256 balance = compToken.balanceOf(address(this));
        require(
            compToken.transfer(vaultAddress, balance),
            "Reward token transfer failed"
        );

        emit RewardTokenCollected(vaultAddress, balance);
    }

    /**
     * @dev Deposit asset into Compound
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
        // TODO: Throw if unsupported
        uint256[NUM_COINS] memory _coins = [uint256(0), uint256(0), uint256(0)];
        _coins[coinsToIndex[_asset]] = _amount;
        threePool.add_liquidity(_coins, uint256(0));
        amountDeposited = _amount;
        emit Deposit(_asset, address(threePool), amountDeposited);
    }

    /**
     * @dev Withdraw asset from Compound
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
        require(_amount > 0, "Must withdraw something");
        require(_recipient != address(0), "Must specify recipient");

        uint256 allPoolTokens = IERC20(threePoolToken).balanceOf(address(this));
        uint256 maxAsset = threePool.calc_withdraw_one_coin(
            allPoolTokens,
            int128(coinsToIndex[_asset])
        );
        uint256 toratora = allPoolTokens.mul(_amount).div(maxAsset);

        threePool.remove_liquidity_one_coin(
            toratora,
            int128(coinsToIndex[_asset]),
            0
        );
        IERC20(_asset).safeTransfer(_recipient, _amount);

        uint256 dust = IERC20(_asset).balanceOf(address(this));
        IERC20(_asset).safeTransfer(vaultAddress, dust);
        emit Withdrawal(_asset, address(threePoolToken), amountWithdrawn);
    }

    /**
     * @dev Remove all assets from platform and send them to Vault contract.
     */
    function liquidate() external onlyVaultOrGovernor {
        uint256 allPoolTokens = IERC20(threePoolToken).balanceOf(address(this));

        for (uint256 i = 0; i < NUM_COINS; i++) {
            address _asset = coins[i];
            uint32 allocation = allocations[i];

            uint256 toWithdraw = allPoolTokens.mul(allocation).div(
                FULL_ALLOCATION
            );
            if (i == NUM_COINS - 1) {
                toWithdraw = IERC20(threePoolToken).balanceOf(address(this));
            } else if (allocation == 0) {
                continue;
            }
            threePool.remove_liquidity_one_coin(
                toWithdraw,
                int128(coinsToIndex[_asset]),
                0
            );
            uint256 toSend = IERC20(_asset).balanceOf(address(this));
            IERC20(_asset).safeTransfer(vaultAddress, toSend);
        }
    }

    /**
     * @dev Get the total asset value held in the platform
     *      This includes any interest that was generated since depositing
     *      Compound exchange rate between the cToken and asset gradually increases,
     *      causing the cToken to be worth more corresponding asset.
     * @param _asset      Address of the asset
     * @return balance    Total value of the asset in the platform
     */
    function checkBalance(address _asset)
        external
        view
        returns (uint256 balance)
    {
        uint256 i = coinsToIndex[_asset];
        uint32 allocation = allocations[i];
        if (allocation == 0) {
            return 0;
        }
        uint256 allPoolTokens = IERC20(threePoolToken).balanceOf(address(this));
        if (allPoolTokens == 0) {
            return 0;
        }
        return
            threePool.calc_withdraw_one_coin(
                allPoolTokens.mul(allocation).div(FULL_ALLOCATION),
                int128(coinsToIndex[_asset])
            );
    }

    /**
     * @dev Retuns bool indicating whether asset is supported by strategy
     * @param _asset Address of the asset
     */
    function supportsAsset(address _asset) external view returns (bool) {
        uint256 i = coinsToIndex[_asset];
        uint32 allocation = allocations[i];
        return allocation > 0;
    }

    /**
     * @dev Approve the spending of all assets by their corresponding pool tokens,
     *      if for some reason is it necessary. Only callable through Governance.
     */
    function safeApproveAllTokens() external {
        uint256 assetCount = assetsMapped.length;
        for (uint256 i = 0; i < assetCount; i++) {
            address asset = assetsMapped[i];
            address cToken = assetToPToken[asset];
            // Safe approval
            IERC20(asset).safeApprove(address(threePool), 0);
            IERC20(asset).safeApprove(address(threePool), uint256(-1));
        }
    }

    /**
     * @dev Get the weighted APR for all assets in strategy.
     * @return APR in 1e18
     */
    function getAPR() external view returns (uint256) {
        return 0;
    }

    /**
     * @dev Get the APR for a single asset.
     * @param _asset Address of the asset
     * @return APR in 1e18
     */
    function getAssetAPR(address _asset) external view returns (uint256) {
        return 0;
    }

    /**
     * @dev Internal method to get the APR for a single asset.
     * @param _asset Address of the asset
     * @return APR in 1e18
     */
    function _getAssetAPR(address _asset) internal view returns (uint256) {
        return 0;
    }

    /**
     * @dev Internal method to respond to the addition of new asset / cTokens
     *      We need to approve the cToken and give it permission to spend the asset
     * @param _asset Address of the asset to approve
     * @param _cToken This cToken has the approval approval
     */
    function _abstractSetPToken(address _asset, address _cToken) internal {
        // Safe approval
        IERC20(_asset).safeApprove(_cToken, 0);
        IERC20(_asset).safeApprove(_cToken, uint256(-1));
    }

    /**
     * @dev Get the pool token wrapped in the ICERC20 interface for this asset.
     * @param _asset Address of the asset
     * @return Corresponding pool token for this asset
     */
    function _getCTokenFor(address _asset) internal view returns (ICERC20) {
        address cToken = assetToPToken[_asset];
        require(cToken != address(0), "cToken does not exist");
        return ICERC20(cToken);
    }

    /**
     * @dev Converts an underlying amount into cToken amount
     *      cTokenAmt = (underlying * 1e18) / exchangeRate
     * @param _cToken     cToken for which to change
     * @param _underlying Amount of underlying to convert
     * @return amount     Equivalent amount of cTokens
     */
    function _convertUnderlyingToCToken(ICERC20 _cToken, uint256 _underlying)
        internal
        view
        returns (uint256 amount)
    {
        require(false, "TODO NAKO");
        uint256 exchangeRate = _cToken.exchangeRateStored();
        // e.g. 1e18*1e18 / 205316390724364402565641705 = 50e8
        // e.g. 1e8*1e18 / 205316390724364402565641705 = 0.45 or 0
        amount = _underlying.mul(1e18).div(exchangeRate);
    }
}

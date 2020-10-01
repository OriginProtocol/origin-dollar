pragma solidity 0.5.11;

/**
 * @title Curve 3Pool Strategy
 * @notice Investment strategy for investing stablecoins via Curve 3Pool
 * @author Origin Protocol Inc
 */
import { IThreePool } from "./IThreePool.sol";
import {
    IERC20,
    InitializableAbstractStrategy
} from "../utils/InitializableAbstractStrategy.sol";

contract ThreePoolStrategy is InitializableAbstractStrategy {
    event RewardTokenCollected(address recipient, uint256 amount);

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
     * @dev Collect accumulated reward token and send to Vault.
     */
    function collectRewardToken() external onlyVault {
        // TODO: Not Implimented yet.
        require(false, "TODO collectRewardToken");
        // emit RewardTokenCollected(vaultAddress, balance);
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
        uint256 i = coinsToIndex[_asset];
        require(allocations[i] > 0, "Must be a supported asset");
        uint256[NUM_COINS] memory _coins = [uint256(0), uint256(0), uint256(0)];
        _coins[i] = _amount;
        threePool.add_liquidity(_coins, uint256(0));
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
        require(_amount > 0, "Must withdraw something");
        require(_recipient != address(0), "Must specify recipient");
        uint256 i = coinsToIndex[_asset];
        uint256 allPoolTokens = IERC20(threePoolToken).balanceOf(address(this));
        uint256 maxAsset = threePool.calc_withdraw_one_coin(
            allPoolTokens,
            int128(i)
        );
        uint256 poolTokens = allPoolTokens.mul(_amount).div(maxAsset);

        threePool.remove_liquidity_one_coin(
            poolTokens,
            int128(i),
            0
        );
        IERC20(_asset).safeTransfer(_recipient, _amount);
        // Transfer any leftover dust back to the vault buffer.
        uint256 dust = IERC20(_asset).balanceOf(address(this));
        IERC20(_asset).safeTransfer(vaultAddress, dust);

        emit Withdrawal(_asset, address(threePoolToken), amountWithdrawn);
    }

    /**
     * @dev Remove all assets from platform and send them to Vault contract.
     */
    function liquidate() external onlyVaultOrGovernor {
        uint256 poolTokens = IERC20(threePoolToken).balanceOf(address(this));

        for (uint256 i = 0; i < NUM_COINS; i++) {
            address _asset = coins[i];
            uint32 allocation = allocations[i];

            uint256 toWithdraw = poolTokens.mul(allocation).div(
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
        uint256 i = coinsToIndex[_asset];
        uint32 allocation = allocations[i];
        if (allocation == 0) {
            return 0;
        }
        uint256 poolTokens = IERC20(threePoolToken).balanceOf(address(this));
        if (poolTokens == 0) {
            return 0;
        }
        return
            threePool.calc_withdraw_one_coin(
                poolTokens.mul(allocation).div(FULL_ALLOCATION),
                int128(i)
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
     *      if for some reason is it necessary.
     */
    function safeApproveAllTokens() external {
        //TODO: ensure Test
        uint256 assetCount = assetsMapped.length;
        for (uint256 i = 0; i < NUM_COINS; i++) {
            address asset = coins[i];
            address cToken = assetToPToken[asset];
            // safeApprove requires that the previous value be zero
            // before setting it to a non-zero value.
            IERC20(asset).safeApprove(address(threePool), 0);
            IERC20(asset).safeApprove(address(threePool), uint256(-1));
        }
    }

    // Deprecated
    function getAPR() external view returns (uint256) {
        return 0;
    }

    // Deprecated
    function getAssetAPR(address _asset) external view returns (uint256) {
        return 0;
    }

    // TODO: Remove
    function _abstractSetPToken(address _asset, address _cToken) internal {
        return;
    }
}

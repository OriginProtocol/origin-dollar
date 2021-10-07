// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { SafeMath } from "@openzeppelin/contracts/utils/math/SafeMath.sol";

import { Initializable } from "../utils/Initializable.sol";
import { StableMath } from "../utils/StableMath.sol";
import { Governable } from "../governance/Governable.sol";

//
// LiquidityReward contract doles out reward for liquidity
//   base off of Sushiswap's MasterChef: https://github.com/sushiswap/sushiswap/blob/master/contracts/MasterChef.sol
//
contract LiquidityReward is Initializable, Governable {
    using SafeMath for uint256;
    using StableMath for uint256;
    using SafeERC20 for IERC20;

    // Info of each user.
    struct UserInfo {
        uint256 amount; // How many LP tokens the user has provided.
        int256 rewardDebt; // Reward debt. See explanation below.
        //
        // We do some fancy math here. Basically, any point in time, the amount of Reward Tokens
        // entitled to a user but is pending to be distributed is:
        //
        //   pending reward = (user.amount * pool.accRewardPerShare) - user.rewardDebt
        //
        // Whenever a user deposits or withdraws LP tokens to a pool. Here's what happens:
        //   1. The pool's `accRewardPerShare` (and `lastRewardBlock`) gets updated.
        //   2. User receives the pending reward sent to his/her address.
        //   3. User's `amount` gets updated.
        //   4. User's `rewardDebt` gets updated.
        //
        // NOTE: rewardDebt can go negative because we allow withdraws without claiming the reward
        //       in that case we owe the account holder some reward.
    }

    // Info of each pool.
    struct PoolInfo {
        IERC20 lpToken; // Address of LP token contract.
        uint256 lastRewardBlock; // Last block number that Reward calculation occurs.
        uint256 accRewardPerShare; // Accumulated Reward per share in reward precision. See below.
    }

    // The Reward token
    IERC20 public reward;

    // Reward tokens created per block in 1e18 precision.
    uint256 public rewardPerBlock;

    // Info on the LP.
    PoolInfo public pool;
    // total Reward debt, useful to calculate if we have enough to pay out all rewards
    int256 public totalRewardDebt;
    // total Supply that is accounted for via deposit/withdraw so that our rewards calc are stable
    uint256 public totalSupply;
    // Info of each user that stakes LP tokens.
    mapping(address => UserInfo) public userInfo;
    // The block number when Liquidity rewards ends.
    uint256 public endBlock;

    event CampaignStarted(
        uint256 rewardRate,
        uint256 startBlock,
        uint256 endBlock
    );
    event CampaignStopped(uint256 endBlock);
    event Deposit(address indexed user, uint256 amount);
    event Withdraw(address indexed user, uint256 amount);
    event Claim(address indexed user, uint256 amount);
    event DrainExtraReward(address indexed user, uint256 amount);
    event DrainExtraLP(address indexed user, uint256 amount);

    /**
     * Initializer for setting up Liquidity Reward internal state.
     * @param _reward Address of the reward token(OGN)
     * @param _lpToken Address of the LP token(Uniswap Pair)
     */
    function initialize(IERC20 _reward, IERC20 _lpToken)
        external
        onlyGovernor
        initializer
    {
        reward = _reward;
        pool.lpToken = _lpToken;
        pool.lastRewardBlock = block.number;
    }

    /**
     * @dev start a new reward campaign.
     *      This will calculate all rewards up to the current block at the old rate.
     *      This ensures that we pay everyone at the promised rate before update to the new rate.
     * @param _rewardPerBlock Amount rewarded per block
     * @param _startBlock Block number that we want to start the rewards at (0 for current block)
     * @param _numBlocks number of blocks that the campaign should last
     */
    function startCampaign(
        uint256 _rewardPerBlock,
        uint256 _startBlock,
        uint256 _numBlocks
    ) external onlyGovernor {
        // Calculate up to the current block at the current rate for everyone.
        updatePool();

        // total Pending calculated at the current pool rate
        uint256 totalPending = subDebt(
            pool.accRewardPerShare.mulTruncate(totalSupply),
            totalRewardDebt
        );

        require(_numBlocks > 0, "startCampaign: zero blocks");

        require(
            reward.balanceOf(address(this)) >=
                _rewardPerBlock.mul(_numBlocks).add(totalPending),
            "startCampaign: insufficient rewards"
        );

        uint256 startBlock = _startBlock;
        if (startBlock == 0) {
            // start block number isn't given so we start at the current
            startBlock = block.number;
        }
        require(
            startBlock >= block.number,
            "startCampaign: _startBlock can't be in the past"
        );
        endBlock = startBlock.add(_numBlocks);
        // we don't start accrue until the startBlock
        pool.lastRewardBlock = startBlock;
        // new blocks start at the new reward rate
        rewardPerBlock = _rewardPerBlock;
        emit CampaignStarted(rewardPerBlock, startBlock, endBlock);
    }

    function stopCampaign() external onlyGovernor {
        //calculate until current pool
        updatePool();
        //end the block here (the CampaignMultiplier will be zero)
        endBlock = block.number;
        emit CampaignStopped(endBlock);
    }

    function drainExtraRewards() external onlyGovernor {
        require(endBlock < block.number, "drainExtraRewards:Campaign active");
        updatePool();
        uint256 extraRewards = reward.balanceOf(address(this)).sub(
            subDebt(
                pool.accRewardPerShare.mulTruncate(totalSupply),
                totalRewardDebt
            )
        );
        if (extraRewards > 0) {
            emit DrainExtraReward(msg.sender, extraRewards);
            reward.safeTransfer(msg.sender, extraRewards);
        }
    }

    function drainExtraLP() external onlyGovernor {
        uint256 extraLP = pool.lpToken.balanceOf(address(this)).sub(
            totalSupply
        );
        require(extraLP > 0, "drainExtraLP:no extra");
        emit DrainExtraLP(msg.sender, extraLP);
        pool.lpToken.safeTransfer(msg.sender, extraLP);
    }

    function campaignActive() external view returns (bool) {
        return endBlock > block.number && block.number >= pool.lastRewardBlock;
    }

    function balanceOf(address _account) external view returns (uint256) {
        return userInfo[_account].amount;
    }

    /**
     * @dev calculate the number of blocks since we last updated
     *       within start and end as constraints
     * @param _to Block number of the ending point.
     * @return multiplier Multiplier over the given _from to _to block.
     */
    function getCampaignMultiplier(uint256 _to)
        internal
        view
        returns (uint256)
    {
        uint256 from = pool.lastRewardBlock;
        if (from > endBlock) {
            return 0;
        } else {
            return (_to < endBlock ? _to : endBlock).sub(from);
        }
    }

    /**
     * @dev View function to see pending rewards for each account on frontend.
     * @param _user Address of the account we're looking up.
     * @return reward Total rewards owed to this account.
     */
    function pendingRewards(address _user) external view returns (uint256) {
        UserInfo storage user = userInfo[_user];
        return _pendingRewards(user);
    }

    function _pendingRewards(UserInfo storage user)
        internal
        view
        returns (uint256)
    {
        uint256 accRewardPerShare = pool.accRewardPerShare;
        if (block.number > pool.lastRewardBlock) {
            if (totalSupply != 0) {
                uint256 multiplier = getCampaignMultiplier(block.number);
                uint256 incReward = multiplier.mul(rewardPerBlock);
                accRewardPerShare = accRewardPerShare.add(
                    incReward.divPrecisely(totalSupply)
                );
            }
        }
        return
            subDebt(
                user.amount.mulTruncate(accRewardPerShare),
                user.rewardDebt
            );
    }

    /**
     * @dev View function to see total outstanding rewards for the entire contract.
     *      This is how much is owed when everyone pulls out.
     * @return reward Total rewards owed to everyone.
     */
    function totalOutstandingRewards() external view returns (uint256) {
        if (block.number > pool.lastRewardBlock && totalSupply != 0) {
            uint256 multiplier = getCampaignMultiplier(block.number);
            uint256 incReward = multiplier.mul(rewardPerBlock);
            uint256 accRewardPerShare = pool.accRewardPerShare;
            accRewardPerShare = accRewardPerShare.add(
                incReward.divPrecisely(totalSupply)
            );
            return
                subDebt(
                    accRewardPerShare.mulTruncate(totalSupply),
                    totalRewardDebt
                );
        }
        // no supply or not even started
        return 0;
    }

    /**
     * @dev External call for updating the pool.
     */
    function doUpdatePool() external {
        // There should be no harm allowing anyone to call this function.
        // It just updates the latest accRewardPerShare for the pool.
        updatePool();
    }

    /**
     * @dev Update the Liquidity Pool reward multiplier.
     *      This locks in the accRewardPerShare from the last update block number to now.
     *      Will fail if we do not have enough to pay everyone.
     *      Always call updatePool whenever the balance changes!
     */
    function updatePool() internal {
        if (
            block.number <= pool.lastRewardBlock ||
            endBlock <= pool.lastRewardBlock
        ) {
            return;
        }

        if (totalSupply == 0) {
            pool.lastRewardBlock = block.number;
            return;
        }

        uint256 incReward = getCampaignMultiplier(block.number).mul(
            rewardPerBlock
        );
        // we are of course assuming lpTokens are in 1e18 precision
        uint256 accRewardPerShare = pool.accRewardPerShare.add(
            incReward.divPrecisely(totalSupply)
        );

        pool.accRewardPerShare = accRewardPerShare;
        pool.lastRewardBlock = block.number;
    }

    /**
     * @dev Deposit LP tokens into contract, must be preapproved.
     * @param _amount Amount of LPToken to deposit.
     */
    function deposit(uint256 _amount) external {
        UserInfo storage user = userInfo[msg.sender];
        updatePool();
        if (_amount > 0) {
            user.amount = user.amount.add(_amount);
            // newDebt is equal to the change in amount * accRewardPerShare (note accRewardPerShare is historic)
            int256 newDebt = int256(
                _amount.mulTruncate(pool.accRewardPerShare)
            );
            user.rewardDebt += newDebt;
            totalRewardDebt += newDebt;
            totalSupply = totalSupply.add(_amount);
            emit Deposit(msg.sender, _amount);
            pool.lpToken.safeTransferFrom(
                address(msg.sender),
                address(this),
                _amount
            );
        }
    }

    /**
     * @dev Exit out of the contract completely, withdraw LP tokens and claim rewards
     */
    function exit() external {
        UserInfo storage user = userInfo[msg.sender];
        // withdraw everything
        _withdraw(user, user.amount, true);
    }

    /**
     * @dev Withdraw LP tokens from contract.
     * @param _amount Amount of LPToken to withdraw.
     * @param _claim Boolean do we want to claim our rewards or not
     */
    function withdraw(uint256 _amount, bool _claim) external {
        UserInfo storage user = userInfo[msg.sender];
        _withdraw(user, _amount, _claim);
    }

    function _withdraw(
        UserInfo storage user,
        uint256 _amount,
        bool _claim
    ) internal {
        require(user.amount >= _amount, "withdraw: overflow");
        updatePool();

        // newDebt is equal to the change in amount * accRewardPerShare (note accRewardPerShare is historic)
        int256 newDebt = -int256(_amount.mulTruncate(pool.accRewardPerShare));
        uint256 pending = 0;
        if (_claim) {
            //This is an optimization so we don't modify the storage variable twice
            pending = subDebt(
                user.amount.mulTruncate(pool.accRewardPerShare),
                user.rewardDebt
            );

            newDebt += int256(pending);
        }

        user.rewardDebt += newDebt;
        totalRewardDebt += newDebt;
        emit Withdraw(msg.sender, _amount);
        // actually make the changes to the amount and debt
        if (_amount > 0) {
            user.amount = user.amount.sub(_amount);
            totalSupply = totalSupply.sub(_amount, "withdraw: total overflow");
        }
        //putting this all at the end to avoid reentrancy error
        if (pending > 0) {
            emit Claim(msg.sender, pending);
            reward.safeTransfer(msg.sender, pending);
        }
        if (_amount > 0) {
            pool.lpToken.safeTransfer(address(msg.sender), _amount);
        }
    }

    /**
     * @dev Claim all pending rewards up to current block
     */
    function claim() external {
        UserInfo storage user = userInfo[msg.sender];
        uint256 pending = _pendingRewards(user);
        if (pending > 0) {
            emit Claim(msg.sender, pending);
            int256 debtDelta = int256(pending);
            user.rewardDebt += debtDelta;
            totalRewardDebt += debtDelta;
            reward.safeTransfer(msg.sender, pending);
        }
    }

    function subDebt(uint256 amount, int256 debt)
        internal
        pure
        returns (uint256 result)
    {
        if (debt < 0) {
            result = amount.add(uint256(-debt));
        } else {
            result = amount.sub(uint256(debt));
        }
    }
}

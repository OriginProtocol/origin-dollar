pragma solidity 0.5.11;
pragma experimental ABIEncoderV2;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeMath } from "@openzeppelin/contracts/math/SafeMath.sol";
import {
    Initializable
} from "@openzeppelin/upgrades/contracts/Initializable.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import { Governable } from "../governance/Governable.sol";
import { StableMath } from "../utils/StableMath.sol";

contract SingleAssetStaking is Initializable, Governable {
    using SafeMath for uint256;
    using StableMath for uint256;
    using SafeERC20 for IERC20;

    /* ========== STATE VARIABLES ========== */

    IERC20 public stakingToken; // this is both the staking and rewards

    struct Stake {
        uint256 amount; // amount to stake
        uint256 end; // when does the staking period end
        uint256 duration; // the duration of the stake
        uint240 rate; // rate to charge use 248 to reserve 8 bits for the bool
        bool paid;
        uint8 stakeType;
    }

    uint256[] public durations; // allowed durations
    uint256[] public rates; // rates that corrospond with the allowed durations

    uint256 public totalOutstanding;
    bool public paused;

    mapping(address => Stake[]) public userStakes;

    address private preApprover;

    uint8 constant USER_STAKE_TYPE = 0;

    /* ========== Initialize ========== */

    /**
     * @dev Initialize the contracts, sets up durations, rates, and preApprover
     *      for preApproved contracts can only be called once
     * @param _stakingToken Address of the token that we are staking
     * @param _durations Array of allowed durations in seconds
     * @param _rates Array of rates(0.3 is 30%) that corrospond to the allowed
     *               durations in 1e18 precision
     * @param _preApprover Address to verify preApproved stakes, 0 to disable
     */
    function initialize(
        address _stakingToken,
        uint256[] calldata _durations,
        uint256[] calldata _rates,
        address _preApprover
    ) external onlyGovernor initializer {
        stakingToken = IERC20(_stakingToken);
        _setDurationRates(_durations, _rates);
        _setPreApprover(_preApprover);
    }

    /* ========= Internal helper functions ======== */

    /**
     * @dev Validate and set the duration and corrosponding rates, will emit
     *      events NewRate and NewDurations
     */
    function _setDurationRates(
        uint256[] memory _durations,
        uint256[] memory _rates
    ) internal {
        require(
            _rates.length == _durations.length,
            "Mismatch durations and rates"
        );

        for (uint256 i = 0; i < _rates.length; i++) {
            require(_rates[i] < uint240(-1), "Max rate exceeded");
        }

        rates = _rates;
        durations = _durations;

        emit NewRates(msg.sender, rates);
        emit NewDurations(msg.sender, durations);
    }

    function _setPreApprover(address _approver) internal {
        // if address is 0 then then authorized staker is disabled
        preApprover = _approver;
        emit NewPreApprover(_approver);
    }

    function _totalExpectedRewards(Stake[] storage stakes)
        internal
        view
        returns (uint256 total)
    {
        for (uint256 i = 0; i < stakes.length; i++) {
            Stake storage stake = stakes[i];
            if (!stake.paid) {
                total = total.add(stake.amount.mulTruncate(stake.rate));
            }
        }
    }

    function _totalExpected(Stake storage _stake)
        internal
        view
        returns (uint256)
    {
        return _stake.amount.add(_stake.amount.mulTruncate(_stake.rate));
    }

    function _findDurationRate(uint256 duration)
        internal
        view
        returns (uint240)
    {
        for (uint256 i = 0; i < durations.length; i++) {
            if (duration == durations[i]) {
                return uint240(rates[i]);
            }
        }
        return 0;
    }

    /**
     * @dev Internal staking function
     *      will insert the stake into the stakes array and verify we have
     *      enough to pay off stake + reward
     * @param staker Address of the staker
     * @param stakeType Number that represent the type of the stake, 0 is user
     *                  initiated all else is currently preApproved
     * @param duration Number of seconds this stake will be held for
     * @param rate Rate(0.3 is 30%) of reward for this stake in 1e18, uint240 =
     *             to fit the bool and type in struct Stake
     * @param amount Number of tokens to stake in 1e18
     */
    function _stake(
        address staker,
        uint8 stakeType,
        uint256 duration,
        uint240 rate,
        uint256 amount
    ) internal {
        require(!paused, "Staking paused");

        Stake[] storage stakes = userStakes[staker];

        uint256 end = block.timestamp.add(duration);

        uint256 i = stakes.length; // start at the end of the current array
        stakes.length += 1; // grow the array
        // find the spot where we can insert the current stake
        // this should make an increasing list sorted by end
        while (i != 0 && stakes[i - 1].end > end) {
            // shift it back one
            stakes[i] = stakes[i - 1];
            i -= 1;
        }

        // insert the stake
        Stake storage newStake = stakes[i];
        newStake.rate = rate;
        newStake.stakeType = stakeType;
        newStake.end = end;
        newStake.duration = duration;
        newStake.amount = amount;

        totalOutstanding = totalOutstanding.add(_totalExpected(newStake));
        // we need to have enough balance to cover the total outstanding after
        // this
        require(
            stakingToken.balanceOf(address(this)) >= totalOutstanding,
            "Insufficient rewards"
        );
        emit Staked(staker, amount);
    }

    /* ========== VIEWS ========== */

    function getAllDurations() external view returns (uint256[] memory) {
        return durations;
    }

    function getAllRates() external view returns (uint256[] memory) {
        return rates;
    }

    /**
     * @dev Return all the stakes paid and unpaid for a given user
     * @param account Address of the account that we want to look up
     */
    function getAllStakes(address account)
        external
        view
        returns (Stake[] memory)
    {
        return userStakes[account];
    }

    /**
     * @dev Find the rate that corrosponds to a given duration
     * @param _duration Number of seconds
     */
    function durationRewardRate(uint256 _duration)
        external
        view
        returns (uint256)
    {
        return _findDurationRate(_duration);
    }

    /**
     * @dev Calculate all the staked value a user has put into the contract,
     *      rewards not included
     * @param account Address of the account that we want to look up
     */
    function totalStaked(address account)
        external
        view
        returns (uint256 total)
    {
        Stake[] storage stakes = userStakes[account];

        for (uint256 i = 0; i < stakes.length; i++) {
            if (!stakes[i].paid) {
                total = total.add(stakes[i].amount);
            }
        }
    }

    /**
     * @dev Calculate all the rewards a user can expect to receive.
     * @param account Address of the account that we want to look up
     */
    function totalExpectedRewards(address account)
        external
        view
        returns (uint256)
    {
        return _totalExpectedRewards(userStakes[account]);
    }

    /**
     * @dev Calculate all current holdings of a user: staked value + prorated rewards
     * @param account Address of the account that we want to look up
     */
    function totalCurrentHoldings(address account)
        external
        view
        returns (uint256 total)
    {
        Stake[] storage stakes = userStakes[account];

        for (uint256 i = 0; i < stakes.length; i++) {
            Stake storage stake = stakes[i];
            if (stake.paid) {
                continue;
            } else if (stake.end < block.timestamp) {
                total = total.add(_totalExpected(stake));
            } else {
                //calcualte the precentage accrued in term of rewards
                total = total.add(
                    stake.amount.add(
                        stake.amount.mulTruncate(stake.rate).mulTruncate(
                            stake
                                .duration
                                .sub(stake.end.sub(block.timestamp))
                                .divPrecisely(stake.duration)
                        )
                    )
                );
            }
        }
    }

    /* ========== MUTATIVE FUNCTIONS ========== */

    /**
     * @dev Make a preapproved stake for the user, this is a presigned voucher that the user can redeem either from
     *      an airdrop or a compensation program.
     *      Only 1 of each type is allowed per user. Signature must be done by the preApprover.
     * @param stakeType Number that represent the type of the stake, must not be 0 which is user stake
     * @param duration Number of seconds this stake will be held for
     * @param rate Rate(0.3 is 30%) of reward for this stake in 1e18, uint240 to fit the bool and type in struct Stake
     * @param amount Number of tokens to stake in 1e18
     * @param v Signature v component
     * @param r Signature r component
     * @param s Signature s component
     */
    function preApprovedStake(
        uint8 stakeType,
        uint256 duration,
        uint256 rate,
        uint256 amount,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external {
        require(stakeType != USER_STAKE_TYPE, "Cannot be normal staking");

        // message length should be 117 because (uint8)1 + (address) 20 + (uint256)32 + (uint256)32 + (uint256)32
        bytes32 messageDigest = keccak256(
            abi.encodePacked(
                "\x19Ethereum Signed Message:\n117",
                stakeType,
                address(msg.sender),
                duration,
                rate,
                amount
            )
        );

        require(
            preApprover == ecrecover(messageDigest, v, r, s),
            "Stake not approved"
        );

        // verify that we haven't already staked
        Stake[] storage stakes = userStakes[msg.sender];
        for (uint256 i = 0; i < stakes.length; i++) {
            require(stakes[i].stakeType != stakeType, "Already staked");
        }

        _stake(msg.sender, stakeType, duration, uint240(rate), amount);
    }

    /**
     * @dev Stake an approved amount of staking token into the contract.
     *      User must have already approved the contract for specified amount.
     * @param amount Number of tokens to stake in 1e18
     * @param duration Number of seconds this stake will be held for
     */
    function stake(uint256 amount, uint256 duration) external {
        require(amount > 0, "Cannot stake 0");

        uint240 rewardRate = _findDurationRate(duration);
        require(rewardRate > 0, "Invalid duration"); // we couldn't find the rate that corrospond to the passed duration

        // transfer in the token so that we can stake the correct amount
        stakingToken.safeTransferFrom(msg.sender, address(this), amount);
        _stake(msg.sender, USER_STAKE_TYPE, duration, rewardRate, amount);
    }

    /**
     * @dev Exit out of all possible stakes
     */
    function exit() external {
        Stake[] storage stakes = userStakes[msg.sender];
        require(stakes.length > 0, "Nothing staked");

        uint256 totalWithdraw = 0;
        uint256 l = stakes.length;
        do {
            Stake storage exitStake = stakes[l - 1];
            // stop on the first ended stake that's already been paid
            if (exitStake.end < block.timestamp && exitStake.paid) {
                break;
            }
            //might not be ended
            if (exitStake.end < block.timestamp) {
                //we are paying out the stake
                exitStake.paid = true;
                totalWithdraw = totalWithdraw.add(_totalExpected(exitStake));
            }
            l--;
        } while (l > 0);
        require(totalWithdraw > 0, "All stakes in lock-up");

        stakingToken.safeTransfer(msg.sender, totalWithdraw);
        totalOutstanding = totalOutstanding.sub(totalWithdraw);
        emit Withdrawn(msg.sender, totalWithdraw);
    }

    /* ========== MODIFIERS ========== */

    function setPaused(bool _paused) external onlyGovernor {
        paused = _paused;
        emit Paused(msg.sender, paused);
    }

    /**
     * @dev Set new durations and rates will not effect existing stakes
     * @param _durations Array of durations in seconds
     * @param _rates Array of rates that corrosponds to the durations (0.01 is 1%) in 1e18
     */
    function setDurationRates(
        uint256[] calldata _durations,
        uint256[] calldata _rates
    ) external onlyGovernor {
        _setDurationRates(_durations, _rates);
    }

    function setPreApprover(address _staker) external onlyGovernor {
        _setPreApprover(_staker);
    }

    /* ========== EVENTS ========== */

    event Staked(address indexed user, uint256 amount);
    event Withdrawn(address indexed user, uint256 amount);
    event Recovered(address token, uint256 amount);
    event Paused(address indexed user, bool yes);
    event NewDurations(address indexed user, uint256[] durations);
    event NewRates(address indexed user, uint256[] rates);
    event NewPreApprover(address indexed user);
}

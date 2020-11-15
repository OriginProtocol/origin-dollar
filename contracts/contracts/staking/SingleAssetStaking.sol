pragma solidity 0.5.11;

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
      uint256 rate;
      uint256 amount;   // amount to stake
      uint256 end;      // when does the staking period end
      uint256 duration; // the duration of the stake
    }

    uint256 public rewardRate; // annualized reward rate
    uint256[] public durations; // allowed durations

    uint256 public totalOutstanding;
    bool public paused;

    mapping(address => Stake[]) public userStakes;

    /* ========== CONSTRUCTOR ========== */

    function initialize(
        address _stakingToken,
        uint256 _rewardRate,
        uint256[] calldata _durations
    ) external onlyGovernor initializer {
        stakingToken = IERC20(_stakingToken);
        rewardRate = _rewardRate;
        durations = _durations;

        emit NewRate(msg.sender, rewardRate);
        emit NewDurations(msg.sender, durations);
    }
    
    /* ========= Internal helper functions ======== */

    function _calcRewardMultiplier(uint256 rate, uint256 duration) internal pure returns (uint256) {
      return rate.mulTruncate(duration.divPrecisely(365 days));
    }

    function _totalExpectedRewards(Stake[] storage stakes) internal view returns (uint256 total) {
      for (uint i=0; i< stakes.length; i++) {
        Stake storage stake = stakes[i];
        total += stake.amount.mulTruncate(_calcRewardMultiplier(stake.rate, stake.duration));
      }
    }

    function _totalExpected(Stake storage _stake) internal view returns (uint256) {
      return _stake.amount + _stake.amount.mulTruncate(_calcRewardMultiplier(_stake.rate, _stake.duration));
    }

    function _supportedDuration(uint256 duration) internal view returns (bool) {
      for (uint i =0; i < durations.length; i++) {
        if (duration == durations[i]) {
          return true;
        }
      }
      return false;
    }



    /* ========== VIEWS ========== */

    function totalStaked(address account) external view returns (uint256 total) {
      Stake[] storage stakes = userStakes[account];

      for (uint i=0; i< stakes.length; i++) {
        total += stakes[i].amount;
      }
    }

    function totalExpectedRewards(address account) external view returns (uint256) {
      return _totalExpectedRewards(userStakes[account]);
    }

    function totalCurrentHoldings(address account) external view returns (uint256 total) {
      Stake[] storage stakes = userStakes[account];

      for (uint i=0; i< stakes.length; i++) {
        Stake storage stake = stakes[i];
        if (stake.end < block.timestamp) {
          total += _totalExpected(stake);
        } else {
          //calcualte the precentage accrued in term of rewards
          total += stake.amount
          .add(
            stake.amount
            .mulTruncate(
              _calcRewardMultiplier(stake.rate, stake.duration)
            ).mulTruncate( 
            stake.duration.sub(stake.end.sub(block.timestamp))
            .divPrecisely(stake.duration)
                         )
          );
        }
      }
    }

    /* ========== MUTATIVE FUNCTIONS ========== */

    function stake(uint256 amount, uint256 duration) external {
        require(!paused, "Staking paused");
        require(amount > 0, "Cannot stake 0");
        require(_supportedDuration(duration), "Duration not supported");

        Stake[] storage stakes = userStakes[msg.sender];
        
        uint256 end = block.timestamp + duration;

        uint i = stakes.length; // start counting at the end of the current array
        stakes.length += 1;     //grow the array;
        // find the spot where we can insert the current stake
        while (i != 0  && stakes[i-1].end > end) {
          // shift it back one
          stakes[i] = stakes[i-1];
          i -= 1;
        }

        // insert the stake
        Stake storage newStake = stakes[i];
        newStake.rate = rewardRate;
        newStake.end = end;
        newStake.duration = duration;
        newStake.amount = amount;

        stakingToken.safeTransferFrom(msg.sender, address(this), amount);
        totalOutstanding = totalOutstanding.add(_totalExpected(newStake));
        //we need to have enough balance to cover the total outstanding after this.
        require(stakingToken.balanceOf(address(this)) >= totalOutstanding, "Insufficient rewards");
        emit Staked(msg.sender, amount);
    }

    function exit() external  {
        Stake[] storage stakes = userStakes[msg.sender];
        require(stakes.length > 0, "Nothing staked");

        uint totalWithdraw = 0;
        uint l = stakes.length;
        do {
          Stake storage exitStake = stakes[l-1];
          // if we haven't go to the end here then the previous ones haven't ended yet
          if (exitStake.end > block.timestamp)
          {
            break;
          }
          totalWithdraw += _totalExpected(exitStake);
          l--;
        } while (l > 0);

        //here's how much we should shrink the array by
        stakes.length = l;

        stakingToken.safeTransfer(msg.sender, totalWithdraw);
        totalOutstanding = totalOutstanding.sub(totalWithdraw);
        emit Withdrawn(msg.sender, totalWithdraw);
    }


    /* ========== MODIFIERS ========== */

    function setPaused(bool _paused) external onlyGovernor {
      paused = _paused;
      emit Paused(msg.sender, paused);
    }

    function setDurations(uint256 [] calldata _durations) external onlyGovernor {
      durations = _durations;
      emit NewDurations(msg.sender, durations);
    }

    function setRewardRate(uint256 _rewardRate) external onlyGovernor {
      rewardRate = _rewardRate;
      emit NewRate(msg.sender, rewardRate);
    }



    /* ========== EVENTS ========== */

    event Staked(address indexed user, uint256 amount);
    event Withdrawn(address indexed user, uint256 amount);
    event Recovered(address token, uint256 amount);
    event Paused(address indexed user, bool yes);
    event NewDurations(address indexed user, uint256 [] durations);
    event NewRate(address indexed user, uint256 rate);
}

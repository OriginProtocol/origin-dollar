// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.0;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeMath } from "@openzeppelin/contracts/utils/math/SafeMath.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import { Initializable } from "../utils/Initializable.sol";
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

    struct DropRoot {
        bytes32 hash;
        uint256 depth;
    }

    uint256[] public durations; // allowed durations
    uint256[] public rates; // rates that correspond with the allowed durations

    uint256 public totalOutstanding;
    bool public paused;

    mapping(address => Stake[]) public userStakes;

    mapping(uint8 => DropRoot) public dropRoots;

    // type 0 is reserved for stakes done by the user, all other types will be drop/preApproved stakes
    uint8 constant USER_STAKE_TYPE = 0;
    uint256 constant MAX_STAKES = 256;

    address public transferAgent;

    /* ========== Initialize ========== */

    /**
     * @dev Initialize the contracts, sets up durations, rates, and preApprover
     *      for preApproved contracts can only be called once
     * @param _stakingToken Address of the token that we are staking
     * @param _durations Array of allowed durations in seconds
     * @param _rates Array of rates(0.3 is 30%) that correspond to the allowed
     *               durations in 1e18 precision
     */
    function initialize(
        address _stakingToken,
        uint256[] calldata _durations,
        uint256[] calldata _rates
    ) external onlyGovernor initializer {
        stakingToken = IERC20(_stakingToken);
        _setDurationRates(_durations, _rates);
    }

    /* ========= Internal helper functions ======== */

    /**
     * @dev Validate and set the duration and corresponding rates, will emit
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
            require(_rates[i] < type(uint240).max, "Max rate exceeded");
        }

        rates = _rates;
        durations = _durations;

        emit NewRates(msg.sender, rates);
        emit NewDurations(msg.sender, durations);
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

    function _airDroppedStakeClaimed(address account, uint8 stakeType)
        internal
        view
        returns (bool)
    {
        Stake[] storage stakes = userStakes[account];
        for (uint256 i = 0; i < stakes.length; i++) {
            if (stakes[i].stakeType == stakeType) {
                return true;
            }
        }
        return false;
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

        require(i < MAX_STAKES, "Max stakes");

        stakes.push(); // grow the array
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

        emit Staked(staker, amount, duration, rate);
    }

    function _stakeWithChecks(
        address staker,
        uint256 amount,
        uint256 duration
    ) internal {
        require(amount > 0, "Cannot stake 0");

        uint240 rewardRate = _findDurationRate(duration);
        require(rewardRate > 0, "Invalid duration"); // we couldn't find the rate that correspond to the passed duration

        _stake(staker, USER_STAKE_TYPE, duration, rewardRate, amount);
        // transfer in the token so that we can stake the correct amount
        stakingToken.safeTransferFrom(staker, address(this), amount);
    }

    modifier requireLiquidity() {
        // we need to have enough balance to cover the rewards after the operation is complete
        _;
        require(
            stakingToken.balanceOf(address(this)) >= totalOutstanding,
            "Insufficient rewards"
        );
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
     * @dev Find the rate that corresponds to a given duration
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
     * @dev Has the airdropped stake already been claimed
     */
    function airDroppedStakeClaimed(address account, uint8 stakeType)
        external
        view
        returns (bool)
    {
        return _airDroppedStakeClaimed(account, stakeType);
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
     *      Only 1 of each type is allowed per user. The proof must match the root hash
     * @param index Number that is zero base index of the stake in the payout entry
     * @param stakeType Number that represent the type of the stake, must not be 0 which is user stake
     * @param duration Number of seconds this stake will be held for
     * @param rate Rate(0.3 is 30%) of reward for this stake in 1e18, uint240 to fit the bool and type in struct Stake
     * @param amount Number of tokens to stake in 1e18
     * @param merkleProof Array of proofs for that amount
     */
    function airDroppedStake(
        uint256 index,
        uint8 stakeType,
        uint256 duration,
        uint256 rate,
        uint256 amount,
        bytes32[] calldata merkleProof
    ) external requireLiquidity {
        require(stakeType != USER_STAKE_TYPE, "Cannot be normal staking");
        require(rate < type(uint240).max, "Max rate exceeded");
        require(index < 2**merkleProof.length, "Invalid index");
        DropRoot storage dropRoot = dropRoots[stakeType];
        require(merkleProof.length == dropRoot.depth, "Invalid proof");

        // Compute the merkle root
        bytes32 node = keccak256(
            abi.encodePacked(
                index,
                stakeType,
                address(this),
                msg.sender,
                duration,
                rate,
                amount
            )
        );
        uint256 path = index;
        for (uint16 i = 0; i < merkleProof.length; i++) {
            if ((path & 0x01) == 1) {
                node = keccak256(abi.encodePacked(merkleProof[i], node));
            } else {
                node = keccak256(abi.encodePacked(node, merkleProof[i]));
            }
            path /= 2;
        }

        // Check the merkle proof
        require(node == dropRoot.hash, "Stake not approved");

        // verify that we haven't already staked
        require(
            !_airDroppedStakeClaimed(msg.sender, stakeType),
            "Already staked"
        );

        _stake(msg.sender, stakeType, duration, uint240(rate), amount);
    }

    /**
     * @dev Stake an approved amount of staking token into the contract.
     *      User must have already approved the contract for specified amount.
     * @param amount Number of tokens to stake in 1e18
     * @param duration Number of seconds this stake will be held for
     */
    function stake(uint256 amount, uint256 duration) external requireLiquidity {
        // no checks are performed in this function since those are already present in _stakeWithChecks
        _stakeWithChecks(msg.sender, amount, duration);
    }

    /**
     * @dev Stake an approved amount of staking token into the contract. This function
     *      can only be called by OGN token contract.
     * @param staker Address of the account that is creating the stake
     * @param amount Number of tokens to stake in 1e18
     * @param duration Number of seconds this stake will be held for
     */
    function stakeWithSender(
        address staker,
        uint256 amount,
        uint256 duration
    ) external requireLiquidity returns (bool) {
        require(
            msg.sender == address(stakingToken),
            "Only token contract can make this call"
        );

        _stakeWithChecks(staker, amount, duration);
        return true;
    }

    /**
     * @dev Exit out of all possible stakes
     */
    function exit() external requireLiquidity {
        Stake[] storage stakes = userStakes[msg.sender];
        require(stakes.length > 0, "Nothing staked");

        uint256 totalWithdraw = 0;
        uint256 stakedAmount = 0;
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
                stakedAmount = stakedAmount.add(exitStake.amount);
            }
            l--;
        } while (l > 0);
        require(totalWithdraw > 0, "All stakes in lock-up");

        totalOutstanding = totalOutstanding.sub(totalWithdraw);
        emit Withdrawn(msg.sender, totalWithdraw, stakedAmount);
        stakingToken.safeTransfer(msg.sender, totalWithdraw);
    }

    /**
     * @dev Use to transfer all the stakes of an account in the case that the account is compromised
     *      Requires access to both the account itself and the transfer agent
     * @param _frmAccount the address to transfer from
     * @param _dstAccount the address to transfer to(must be a clean address with no stakes)
     * @param r r portion of the signature by the transfer agent
     * @param s s portion of the signature
     * @param v v portion of the signature
     */
    function transferStakes(
        address _frmAccount,
        address _dstAccount,
        bytes32 r,
        bytes32 s,
        uint8 v
    ) external {
        require(transferAgent == msg.sender, "must be transfer agent");
        Stake[] storage dstStakes = userStakes[_dstAccount];
        require(dstStakes.length == 0, "Dest stakes must be empty");
        require(_frmAccount != address(0), "from account not set");
        Stake[] storage stakes = userStakes[_frmAccount];
        require(stakes.length > 0, "Nothing to transfer");

        // matches ethers.signMsg(ethers.utils.solidityPack([string(4), address, adddress, address]))
        bytes32 hash = keccak256(
            abi.encodePacked(
                "\x19Ethereum Signed Message:\n64",
                abi.encodePacked(
                    "tran",
                    address(this),
                    _frmAccount,
                    _dstAccount
                )
            )
        );
        require(ecrecover(hash, v, r, s) == _frmAccount, "Transfer not authed");

        // copy the stakes into the dstAccount array and delete the old one
        userStakes[_dstAccount] = stakes;
        delete userStakes[_frmAccount];
        emit StakesTransfered(_frmAccount, _dstAccount, stakes.length);
    }

    /* ========== MODIFIERS ========== */

    function setPaused(bool _paused) external onlyGovernor {
        paused = _paused;
        emit Paused(msg.sender, paused);
    }

    /**
     * @dev Set new durations and rates will not effect existing stakes
     * @param _durations Array of durations in seconds
     * @param _rates Array of rates that corresponds to the durations (0.01 is 1%) in 1e18
     */
    function setDurationRates(
        uint256[] calldata _durations,
        uint256[] calldata _rates
    ) external onlyGovernor {
        _setDurationRates(_durations, _rates);
    }

    /**
     * @dev Set the agent that will authorize transfers
     * @param _agent Address of agent
     */
    function setTransferAgent(address _agent) external onlyGovernor {
        transferAgent = _agent;
    }

    /**
     * @dev Set air drop root for a specific stake type
     * @param _stakeType Type of staking must be greater than 0
     * @param _rootHash Root hash of the Merkle Tree
     * @param _proofDepth Depth of the Merklke Tree
     */
    function setAirDropRoot(
        uint8 _stakeType,
        bytes32 _rootHash,
        uint256 _proofDepth
    ) external onlyGovernor {
        require(_stakeType != USER_STAKE_TYPE, "Cannot be normal staking");
        dropRoots[_stakeType].hash = _rootHash;
        dropRoots[_stakeType].depth = _proofDepth;
        emit NewAirDropRootHash(_stakeType, _rootHash, _proofDepth);
    }

    /* ========== EVENTS ========== */

    event Staked(
        address indexed user,
        uint256 amount,
        uint256 duration,
        uint256 rate
    );
    event Withdrawn(address indexed user, uint256 amount, uint256 stakedAmount);
    event Paused(address indexed user, bool yes);
    event NewDurations(address indexed user, uint256[] durations);
    event NewRates(address indexed user, uint256[] rates);
    event NewAirDropRootHash(
        uint8 stakeType,
        bytes32 rootHash,
        uint256 proofDepth
    );
    event StakesTransfered(
        address indexed fromUser,
        address toUser,
        uint256 numStakes
    );
}

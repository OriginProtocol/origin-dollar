import "./common.spec";
import "./AccountInvariants.spec";

// holds the credits sum of all accounts in stdNonRebasing state.
ghost mathint sumAllNonRebasingBalances {
	init_state axiom sumAllNonRebasingBalances == 0;
}

// holds the credits sum of all accounts in one of the following states: NotSet, StdRebasing, and YieldDelegationTarget.
ghost mathint sumAllRebasingBalances {
	init_state axiom sumAllRebasingBalances == 0;
}

ghost mapping(address => uint256) creditBalancesMirror {
	init_state axiom forall address account . creditBalancesMirror[account] == 0;
}

ghost mapping(address => OUSD.RebaseOptions) rebaseStateMirror {
	init_state axiom forall address account . rebaseStateMirror[account] == NotSet();
}

hook Sload uint256 creditBalance creditBalances[KEY address account] {
    require creditBalance == creditBalancesMirror[account];
}

hook Sload OUSD.RebaseOptions rebaseOption rebaseState[KEY address account] {
    require rebaseOption == rebaseStateMirror[account];
}

// rebaseState is always updated before updating the credits balance (when it is updated) so the best way to keep track of credit balance per state 
// is to add the changes when the credits are updated with consideration to the current account rebasing state.
hook Sstore creditBalances[KEY address account] uint256 new_creditBalance (uint256 old_creditBalance) {
    require old_creditBalance == creditBalancesMirror[account];
	if (rebaseStateMirror[account] == StdNonRebasing()) {
		sumAllNonRebasingBalances = sumAllNonRebasingBalances - old_creditBalance + new_creditBalance;
	} else if (rebaseStateMirror[account] != YieldDelegationSource()) {
		sumAllRebasingBalances = sumAllRebasingBalances - old_creditBalance + new_creditBalance;
	}
    creditBalancesMirror[account] = new_creditBalance;
}

hook Sstore rebaseState[KEY address account] OUSD.RebaseOptions new_rebaseOption (OUSD.RebaseOptions old_rebaseOption) {
    require old_rebaseOption == rebaseStateMirror[account];
	// transitioning out of StdNonRebasing state - subtract balance from sumAllNonRebasing
	if(old_rebaseOption == StdNonRebasing() && new_rebaseOption != StdNonRebasing()) {
		sumAllNonRebasingBalances = sumAllNonRebasingBalances - creditBalancesMirror[account];
	// transitioning into StdNonRebasing state - add balance to sumAllNonRebasing
	} else if (old_rebaseOption != StdNonRebasing() && new_rebaseOption == StdNonRebasing()) {
		sumAllNonRebasingBalances = sumAllNonRebasingBalances + creditBalancesMirror[account];
	}
	// transitioning into rebasing state - add balance to sumAllRebasing
	if (!isRebasing(old_rebaseOption) && isRebasing(new_rebaseOption)) {
		sumAllRebasingBalances = sumAllRebasingBalances + creditBalancesMirror[account];
	}
	// transitioning out of rebasing state - subtract balance from sumAllRebasing
	else if (isRebasing(old_rebaseOption) && !isRebasing(new_rebaseOption)) {
		sumAllRebasingBalances = sumAllRebasingBalances - creditBalancesMirror[account];
	}

    rebaseStateMirror[account] = new_rebaseOption;
}

/// @title The sum of all RebaseOptions.StdNonRebasing accounts equals the nonRebasingSupply.
/// @property Balance Invariants
invariant sumAllNonRebasingBalancesEqNonRebasingSupply() 
	sumAllNonRebasingBalances == nonRebasingSupply()
	{
		preserved {
			initTotalSupply();
			allAccountValidState();
			require OUSD.rebasingCreditsPerToken_ >= e18();
		}
	}

/// @title The sum of the credits in all NotSet, StdRebasing, and YieldDelegationTarget accounts equal the rebasingCredits.
/// @property Balance Invariants
invariant sumAllRebasingCreditsEqRebasingCredits() 
	sumAllRebasingBalances == rebasingCreditsHighres()
	{
		preserved {
			initTotalSupply();
			allAccountValidState();
			require OUSD.rebasingCreditsPerToken_ >= e18();
		}
	}

/// @title Ensure correlation between the sum of the credits in all NotSet, StdRebasing, and YieldDelegationTarget accounts match 
/// the rebasingCredits allowing for a bounded rounding error calculated as `rebasingCreditsPerToken / 1e18` for both rebaseOptIn and governanceRebaseOptIn.
/// @property Balance Invariants
rule sumAllRebasingCreditsAndTotalRebasingCreditsCorelation(method f) 
	filtered{f -> f.selector == sig:rebaseOptIn().selector ||
				  f.selector == sig:governanceRebaseOptIn(address).selector} 
	{
	env e;
	calldataarg args;

	initTotalSupply();
	allAccountValidState();
	require OUSD.rebasingCreditsPerToken_ >= e18();

	require sumAllRebasingBalances == rebasingCreditsHighres();

	f(e, args);

	assert EqualUpTo(sumAllRebasingBalances, rebasingCreditsHighres(), BALANCE_ROUNDING_ERROR(OUSD.rebasingCreditsPerToken_));
}

/// @title Verify that the total supply remains within the maximum allowable limit.
/// @property Balance Invariants
invariant totalSupplyLessThanMaxSupply()
	OUSD.totalSupply() <= max_uint128
	{
		preserved {
			initTotalSupply();
			allAccountValidState();
			require OUSD.rebasingCreditsPerToken_ >= e18();
			requireInvariant sumAllNonRebasingBalancesEqNonRebasingSupply();
			require isInitialized();
		}
	}

/// @title Verify that the total balance of delegator and delegatee remains unchanged after yield delegation.
/// @property Balance Invariants
rule delegateYieldPreservesSumOfBalances(address from, address to, address other) {
	env e;
	initTotalSupply();
	allAccountValidState();
	require OUSD.rebasingCreditsPerToken_ >= e18();
	require other != from;
	require other != to;

	uint256 fromBalancePre = OUSD.balanceOf(from);
	uint256 toBalancePre = OUSD.balanceOf(to);
	uint256 otherBalancePre = OUSD.balanceOf(other);
	uint256 totalSupplyPre = OUSD.totalSupply();

	mathint sumBalancesPre = fromBalancePre + toBalancePre;

	delegateYield(e, from, to);

	uint256 fromBalancePost = OUSD.balanceOf(from);
	uint256 toBalancePost = OUSD.balanceOf(to);
	uint256 otherBalancePost = OUSD.balanceOf(other);
	uint256 totalSupplyPost = OUSD.totalSupply();

	mathint sumBalancesPost = fromBalancePost + toBalancePost;

	assert sumBalancesPre == sumBalancesPost;
	assert otherBalancePre == otherBalancePost;
	assert totalSupplyPre == totalSupplyPost;
}

/// @title Verify that the total balance of delegator and delegatee remains unchanged after undelegation.
/// @property Balance Invariants
rule undelegateYieldPreservesSumOfBalances(address from, address other) {
	env e;
	initTotalSupply();
	allAccountValidState();
	require OUSD.rebasingCreditsPerToken_ >= e18();
	address yieldedTo = OUSD.yieldTo[from];
	require other != from;
	require other != yieldedTo;

	uint256 fromBalancePre = OUSD.balanceOf(from);
	uint256 toBalancePre = OUSD.balanceOf(yieldedTo);
	uint256 otherBalancePre = OUSD.balanceOf(other);
	uint256 totalSupplyPre = OUSD.totalSupply();

	mathint sunBalancesPre = fromBalancePre + toBalancePre;

	undelegateYield(e, from);

	uint256 fromBalancePost = OUSD.balanceOf(from);
	uint256 toBalancePost = OUSD.balanceOf(yieldedTo);
	uint256 otherBalancePost = OUSD.balanceOf(other);
	uint256 totalSupplyPost = OUSD.totalSupply();

	mathint sunBalancesPost = fromBalancePost + toBalancePost;

	assert sunBalancesPost == sunBalancesPre;
	assert otherBalancePre == otherBalancePost;
	assert totalSupplyPre == totalSupplyPost;
}

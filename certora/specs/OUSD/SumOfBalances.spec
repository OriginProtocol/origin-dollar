import "BalanceInvariants.spec";

definition whoChangesMultipleBalances(method f) returns bool = 
	f.selector == sig:initialize(address,uint256).selector ||
    f.selector == sig:changeSupply(uint256).selector;

definition whoChangesSingleBalance(method f) returns bool = 
	!delegateMethods(f) &&
    !transferMethods(f) &&
    !whoChangesMultipleBalances(f);

/// This function is symmetric with respect to exchange of user <-> yieldFrom[user] and user <-> yieldTo[user].
function effectiveBalance(address user) returns mathint {
    if (rebaseState(user) == YieldDelegationTarget()) {
        return balanceOf(user) + balanceOf(OUSD.yieldFrom[user]);
	} else if (rebaseState(user) == YieldDelegationSource()) {
		return balanceOf(user) + balanceOf(OUSD.yieldTo[user]);
    } else {
        return to_mathint(balanceOf(user));
    }
}

/// @title Auxiliary rule: the effective balance is the same for the same effective account.
rule effectiveBalanceIsEquivalentForSameAccounts(address accountA, address accountB) {
	require OUSD.rebasingCreditsPerToken_ >= e18();
    allAccountValidState();

    assert !differentAccounts(accountA, accountB) => effectiveBalance(accountA) == effectiveBalance(accountB);
}

/// @title Both transfer methods must preserve the sum of balances.
/// The total supply and any balance of a third party cannot change.
/// @property Balance Invariants
rule transferPreservesSumOfBalances(address accountA, address accountB, method f) 
filtered{f -> transferMethods(f)} 
{
	//require OUSD.rebasingCreditsPerToken_ >= e18();
    /// Under-approximation : otherwise timesout.
    require OUSD.rebasingCreditsPerToken_ == 1001*e18()/1000;
    allAccountValidState();
    initTotalSupply();
	/// Third party (different user).
	address other;
	require differentAccounts(other, accountA);
	require differentAccounts(other, accountB);

    mathint balanceA_pre = effectiveBalance(accountA);
    mathint balanceB_pre = effectiveBalance(accountB);
	mathint sumOfBalances_pre = differentAccounts(accountA, accountB) ? balanceA_pre + balanceB_pre : balanceA_pre;
	mathint balanceO_pre = effectiveBalance(other);
	mathint totalSupply_pre = totalSupply();
        env e;
        if(f.selector == sig:transfer(address,uint256).selector) {
			require e.msg.sender == accountA;
			transfer(e, accountB, _);
		} else if(f.selector == sig:transferFrom(address,address,uint256).selector) {
			transferFrom(e, accountA, accountB, _);
		} else {
			assert false;
		}
    mathint balanceA_post = effectiveBalance(accountA);
    mathint balanceB_post = effectiveBalance(accountB);
	mathint sumOfBalances_post = differentAccounts(accountA, accountB) ? balanceA_post + balanceB_post : balanceA_post;
	mathint balanceO_post = effectiveBalance(other);
	mathint totalSupply_post = totalSupply();

	assert differentAccounts(other, accountA), "The third party cannot change its identity status after transfer";
	assert differentAccounts(other, accountB), "The third party cannot change its identity status after transfer";
	assert sumOfBalances_pre == sumOfBalances_post, "The sum of balances must be conserved";
	assert balanceO_pre == balanceO_post, "The balance of a third party cannot change after transfer";
	assert totalSupply_pre == totalSupply_post, "The total supply is invariant to transfer operations";
}

/// @title The sum of balances of any two accounts cannot surpass the total supply.
/// @property Balance Invariants
rule sumOfTwoAccountsBalancesLETotalSupply(address accountA, address accountB, method f) 
filtered{f -> !f.isView && !whoChangesMultipleBalances(f) && !delegateMethods(f) && !transferMethods(f)} 
{
    require OUSD.rebasingCreditsPerToken_ >= e18();
    allAccountValidState();
    initTotalSupply();

    address other;
    require threeDifferentAccounts(accountA, accountB, other);

    mathint balanceA_pre = effectiveBalance(accountA);
    mathint balanceB_pre = effectiveBalance(accountB);
	mathint sumOfBalances_pre = balanceA_pre + balanceB_pre;
	mathint totalSupply_pre = totalSupply();
        env e;
        calldataarg args;
        f(e, args);
    mathint balanceA_post = effectiveBalance(accountA);
    mathint balanceB_post = effectiveBalance(accountB);
	mathint sumOfBalances_post = balanceA_post + balanceB_post;
	mathint totalSupply_post = totalSupply();

	/// Assume that only accountA and accountB balances change.
    require balanceA_pre != balanceA_post && balanceB_pre != balanceB_post;
    
	assert sumOfBalances_pre <= totalSupply_pre => sumOfBalances_post <= totalSupply_post;
}

/// @title The sum of all rebasing account balances cannot surpass the total supply after calling for changeSupply.
/// @property Balance Invariants
rule changeSupplyPreservesSumOFRebasingLesEqTotalSupply(uint256 amount) {
	env e;
	require OUSD.rebasingCreditsPerToken_ >= e18();
    allAccountValidState();
    initTotalSupply();
	require amount >= totalSupply();
	requireInvariant sumAllNonRebasingBalancesEqNonRebasingSupply();
	requireInvariant sumAllRebasingCreditsEqRebasingCredits();
	requireInvariant totalSupplyLessThanMaxSupply();

	require sumAllRebasingBalances * e18() / OUSD.rebasingCreditsPerToken_ <= totalSupply();

	changeSupply(e, amount);

	assert sumAllRebasingBalances * e18() / OUSD.rebasingCreditsPerToken_ <= totalSupply();
}

/// @title Which methods change the balance of a single account.
rule onlySingleAccountBalanceChange(address accountA, address accountB, method f) 
filtered{f -> !f.isView && whoChangesSingleBalance(f)} 
{
	require OUSD.rebasingCreditsPerToken_ >= e18();
    allAccountValidState();
    initTotalSupply();
    /// Require different accounts before
    require differentAccounts(accountA, accountB);
    /// Probe balances before 
    mathint balanceA_pre = effectiveBalance(accountA);
    mathint balanceB_pre = effectiveBalance(accountB);
    /// Call an arbitrary function.
        env e;
        calldataarg args;
        f(e, args);
    /// Require different accounts after
    require differentAccounts(accountA, accountB);
    /// Probe balances after 
    mathint balanceA_post = effectiveBalance(accountA);
    mathint balanceB_post = effectiveBalance(accountB);

    assert balanceA_pre != balanceA_post => balanceB_pre == balanceB_post;
}

/// @title Which methods change the balance of only two accounts.
rule onlyTwoAccountsBalancesChange(address accountA, address accountB, address accountC, method f) 
filtered{f -> !f.isView && !whoChangesMultipleBalances(f) && !delegateMethods(f)} 
{
    require OUSD.rebasingCreditsPerToken_ >= e18();
    allAccountValidState();
    initTotalSupply();
    /// Require different accounts before
    require threeDifferentAccounts(accountA, accountB, accountC);
    /// Probe balances before 
    mathint balanceA_pre = effectiveBalance(accountA);
    mathint balanceB_pre = effectiveBalance(accountB);
    mathint balanceC_pre = effectiveBalance(accountC);
    /// Call an arbitrary function.
        env e;
        calldataarg args;
        f(e, args);
    /// Probe balances after 
    mathint balanceA_post = effectiveBalance(accountA);
    mathint balanceB_post = effectiveBalance(accountB);
    mathint balanceC_post = effectiveBalance(accountC);

    /// Assert different accounts after
    assert threeDifferentAccounts(accountA, accountB, accountC);
    assert balanceA_pre != balanceA_post && balanceB_pre != balanceB_post => balanceC_post == balanceC_pre;
}

/// @title If two accounts become paired / unpaired, then their sum of balances is preserved, and the total supply is unchanged.
rule pairingPreservesSumOfBalances(address accountA, address accountB, method f)
filtered{f -> !f.isView}
{
    require OUSD.rebasingCreditsPerToken_ >= e18();
    allAccountValidState();
    initTotalSupply();

    bool different_before = differentAccounts(accountA, accountB);
    mathint sumOfBalances_pre = balanceOf(accountA) + balanceOf(accountB);
    mathint totalSupply_pre = totalSupply();
        env e;
        calldataarg args;
        f(e, args);
    bool different_after = differentAccounts(accountA, accountB);
    mathint sumOfBalances_post = balanceOf(accountA) + balanceOf(accountB);
    mathint totalSupply_post = totalSupply();

    assert different_before != different_after => sumOfBalances_post == sumOfBalances_pre;
    assert different_before != different_after => totalSupply_pre == totalSupply_post;
}

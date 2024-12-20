import "./common.spec";

function allAccountValidState() {
    requireInvariant DelegationAccountsCorrelation();
    requireInvariant DelegationValidRebaseState();
    requireInvariant stdNonRebasingDoesntYield();
    requireInvariant alternativeCreditsPerTokenIsOneOrZeroOnly();
    requireInvariant yieldDelegationSourceHasNonZeroYeildTo();
    requireInvariant yieldDelegationTargetHasNonZeroYeildFrom();
    requireInvariant yieldToOfZeroIsZero();
    requireInvariant yieldFromOfZeroIsZero();
    requireInvariant cantYieldToSelf();
    requireInvariant cantYieldFromSelf();
    requireInvariant zeroAlternativeCreditsPerTokenStates();
    requireInvariant nonZeroAlternativeCreditsPerTokenStates();
}

/// @title Any non zero valued YieldTo points to an account that has a YieldFrom pointing back to the starting account and vice versa.
/// @property Account Invariants
invariant DelegationAccountsCorrelation()
    forall address account.
        (OUSD.yieldTo[account] != 0 => (OUSD.yieldFrom[OUSD.yieldTo[account]] == account)) 
        &&
        (OUSD.yieldFrom[account] != 0 => (OUSD.yieldTo[OUSD.yieldFrom[account]] == account))
    {
        preserved with (env e) {
            requireInvariant DelegationValidRebaseState();
            requireInvariant yieldToOfZeroIsZero();
            requireInvariant yieldFromOfZeroIsZero();
        }
    }

/// @title Any non zero valued YieldTo points to an account Iff that account is in YieldDelegationSource state and 
/// Any non zero valued YieldFrom points to an account Iff that account is in YieldDelegationTarget state.
/// @property Account Invariants
invariant DelegationValidRebaseState()
    forall address account. 
        (OUSD.yieldTo[account] != 0 <=> OUSD.rebaseState[account] == YieldDelegationSource())
        &&
        (OUSD.yieldFrom[account] != 0 <=> OUSD.rebaseState[account] == YieldDelegationTarget())
    {
        preserved with (env e) {
            requireInvariant DelegationAccountsCorrelation();
            requireInvariant yieldToOfZeroIsZero();
            requireInvariant yieldFromOfZeroIsZero();
        }
    }

/// @title Any account with a zero value in alternativeCreditsPerToken has a rebaseState that is one of (NotSet, StdRebasing, or YieldDelegationTarget)
/// @property Account Invariants
invariant zeroAlternativeCreditsPerTokenStates()
    forall address account . OUSD.alternativeCreditsPerToken[account] == 0 <=> (OUSD.rebaseState[account] == NotSet() || 
                                                OUSD.rebaseState[account] == StdRebasing() || 
                                                OUSD.rebaseState[account] == YieldDelegationTarget())
    {
        preserved {
            requireInvariant yieldToOfZeroIsZero();
            requireInvariant yieldFromOfZeroIsZero();
            requireInvariant DelegationAccountsCorrelation();
            requireInvariant DelegationValidRebaseState();
        }
    }

/// @title Any account with value of 1e18 in alternativeCreditsPerToken has a rebaseState that is one of (StdNonRebasing, YieldDelegationSource)
/// @property Account Invariants
invariant nonZeroAlternativeCreditsPerTokenStates()
    forall address account . OUSD.alternativeCreditsPerToken[account] != 0 <=> (OUSD.rebaseState[account] == StdNonRebasing() ||  
                                                OUSD.rebaseState[account] == YieldDelegationSource())
    {
        preserved undelegateYield(address _account) with (env e) {
            requireInvariant yieldToOfZeroIsZero();
            requireInvariant yieldFromOfZeroIsZero();
            requireInvariant DelegationAccountsCorrelation();
            requireInvariant DelegationValidRebaseState();
        }
    }

/// @title The result of balanceOf of any account in StdNonRebasing state equals the account's credit-balance.
/// @property Balance Invariants
invariant stdNonRebasingBalanceEqCreditBalances(address account)
	OUSD.rebaseState[account] == StdNonRebasing() => OUSD.balanceOf(account) == OUSD.creditBalances[account]
	{
		preserved {
			requireInvariant yieldToOfZeroIsZero();
            requireInvariant yieldFromOfZeroIsZero();
            requireInvariant DelegationAccountsCorrelation();
            requireInvariant DelegationValidRebaseState();
            requireInvariant nonZeroAlternativeCreditsPerTokenStates();
            requireInvariant stdNonRebasingDoesntYield();
            requireInvariant alternativeCreditsPerTokenIsOneOrZeroOnly();
		}
	}

/// @title Any account in StdNonRebasing state doesn't yield to no account.
/// @property Account Invariants
invariant stdNonRebasingDoesntYield()
    forall address account . OUSD.rebaseState[account] == StdNonRebasing() => OUSD.yieldTo[account] == 0
    {
		preserved {
			requireInvariant yieldToOfZeroIsZero();
            requireInvariant yieldFromOfZeroIsZero();
            requireInvariant DelegationAccountsCorrelation();
            requireInvariant DelegationValidRebaseState();
		}
	}

/// @title alternativeCreditsPerToken can only be set to 0 or 1e18, no other values
/// @property Account Invariants
invariant alternativeCreditsPerTokenIsOneOrZeroOnly()
    forall address account . OUSD.alternativeCreditsPerToken[account] == 0 || OUSD.alternativeCreditsPerToken[account] == e18();

/// @title Any account with rebaseState = YieldDelegationSource has a nonZero yieldTo
/// @property Account Invariants
invariant yieldDelegationSourceHasNonZeroYeildTo()
    forall address account . OUSD.rebaseState[account] == YieldDelegationSource() => OUSD.yieldTo[account] != 0;

/// @title Any account with rebaseState = YieldDelegationTarget has a nonZero yieldFrom
/// @property Account Invariants
invariant yieldDelegationTargetHasNonZeroYeildFrom()
    forall address account . OUSD.rebaseState[account] == YieldDelegationTarget() => OUSD.yieldFrom[account] != 0;

// Helper Invariants
/// @title yieldTo of zero is zero
/// @property Account Invariants
invariant yieldToOfZeroIsZero()
    yieldTo(0) == 0;

/// @title yieldFrom of zero is zero
/// @property Account Invariants
invariant yieldFromOfZeroIsZero()
    yieldFrom(0) == 0;

/// @title yieldTo of an account can't be the same as the account
/// @property Account Invariants
invariant cantYieldToSelf()
    forall address account . OUSD.yieldTo[account] != 0 => OUSD.yieldTo[account] != account;

/// @title yieldFrom of an account can't be the same as the account
/// @property Account Invariants
invariant cantYieldFromSelf()
    forall address account . OUSD.yieldFrom[account] != 0 => OUSD.yieldFrom[account] != account;

/// @title Only delegation changes the different effective identity.
/// @property Account Invariants
rule onlyDelegationChangesPairingState(address accountA, address accountB, method f) 
filtered{f -> !f.isView}
{
    bool different_before = differentAccounts(accountA, accountB);
    env e;
    calldataarg args;
    f(e, args);
    bool different_after = differentAccounts(accountA, accountB);

    if(delegateMethods(f)) {
        satisfy different_before != different_after;
    }
    assert different_before != different_after => delegateMethods(f);
}

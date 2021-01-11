methods {
	totalSupply() returns uint256 envfree
	balanceOf(address) returns uint256 envfree
	allowance(address,address) returns uint256 envfree

	rebasingCreditsPerToken() returns uint256 envfree
	nonRebasingCreditsPerToken(address) returns uint256 envfree
	nonRebasingSupply() returns uint256 envfree
	rebasingCredits() returns uint256 envfree

	rebaseState(address) returns uint8 envfree

	// certora harnesses
	Certora_maxSupply() returns uint256 envfree
	Certora_isNonRebasingAccount(address) returns bool envfree
}

definition isRebasing(address u) returns bool = nonRebasingCreditsPerToken(u) == 0 ;
definition OPT_IN() returns uint8 = 2 ;
definition OPT_OUT() returns uint8 = 1 ;
definition ONE() returns uint = 1000000000000000000 ; // 1e18

invariant totalSupplyIsBelowMaxSupply() 
	totalSupply() <= Certora_maxSupply()


rule neverRevert_BalanceOf {
	// probably must assume invariant rebasingCreditsPerTokenMustBeGreaterThan0
	requireInvariant rebasingCreditsPerTokenMustBeGreaterThan0();
	address who;
	invoke balanceOf(who);
	assert !lastReverted;
}

invariant rebasingCreditsPerTokenMustBeGreaterThan0() 
	rebasingCreditsPerToken() > 0
	
// a condition for changeSupply() not to revert:
invariant totalSupplyMustBeStrictlyGreaterThanNonRebasingSupply() 
	totalSupply() > nonRebasingSupply() // probably wrong in constructor/initialization?
	// TODO: Account for the rebasing supply - requires a ghost
	
// otherwise, totalSupply is 0.
invariant rebasingCreditsMustBeGreaterThan0()
		rebasingCredits() > 0  // probably wrong in constructor/initialization?

//@NonLinear
// TODO: Burn - only called by vault - add vault functionality here for the full coverage
rule senderCannotDecreaseOthersBalance(address executor, address who, method f) {
	require executor != who;
	// no approval from who to executor
	require allowance(who, executor) == 0;
	
	uint256 previous = balanceOf(who);
	
	executeAFunctionWithSpecificSender(executor, f);
	
	uint256 current = balanceOf(who);
	assert current >= previous;
}	

rule changesRebaseState(method f) {
	address who;
	
	uint8 _rebaseState = rebaseState(who);
	
	executeAFunction(f);
	
	uint8 rebaseState_ = rebaseState(who);
	assert _rebaseState == rebaseState_ 
			|| f.selector == rebaseOptIn().selector 
			|| f.selector == rebaseOptOut().selector;
}


// TODO: Remove before finalizing.
/*
rule changesBalanceForNonRebasing(method f) {
	address who;
	require !isRebasing(who);
	
	uint256 _b = balanceOf(who);
	
	executeAFunction(f);
	
	uint256 b_ = balanceOf(who);
	assert _b == b_; // expecting only the transfer functions to affect the balance.
}
*/

//@NonLinear
// opt-in and opt-out should be reverses of one another, in terms of preserving: nonRebasingSupply, balanceOf(u), nonRebasingCreditsPerToken(u), rebasingCredits
// WIP: Need to work in more invariants here to prove this one
rule reverseOptInThenOut(address u) {
	requireInvariant rebasingCreditsMustBeGreaterThan0();
	env eF;
	require eF.msg.sender == u;
	
	uint256 _nonRebasingSupply = nonRebasingSupply();
	uint256 _rebasingCredits = rebasingCredits();
	uint256 _balance = balanceOf(u);
	uint256 _nonRebasingCreditsPerToken = nonRebasingCreditsPerToken(u);
	
	// assume currently not opt-in // TODO: Strengthen - should be explicity it's opt-out or require that it is not rebasing at the moment it's run
	require rebaseState(u) != OPT_IN();
	sinvoke rebaseOptIn(eF);
	sinvoke rebaseOptOut(eF);

	uint256 nonRebasingSupply_ = nonRebasingSupply();
	assert _nonRebasingSupply == nonRebasingSupply_, "non rebasing supply must be preserved when opting-in and immediately opting-out";
	
	uint256 rebasingCredits_ = rebasingCredits();
	assert _rebasingCredits == rebasingCredits_, "rebasing credits must be preserved when opting-in and immediately opting-out";
	
	uint256 balance_ = balanceOf(u);
	assert _balance == balance_, "balance of user must be preserved if user opts-in and immediately opts-out";
	
	/* This is expected to fail because previous non rebasing credits per token could be different */
	/*
	uint256 nonRebasingCreditsPerToken_ = nonRebasingCreditsPerToken(u);
	assert _nonRebasingCreditsPerToken == nonRebasingCreditsPerToken_, "non rebasing credits per token of user must be preserved if user opts-in and immediately opts-out";
	*/
}

rule transferCheckPreconds(env e, address to, uint256 value)
{
	require to != 0;
	require value != 0;
	
	address from = e.msg.sender;
	bool precondition = balanceOf(from) >= value;

	bool result = transfer@withrevert(e, to, value);
	bool transferReverted = lastReverted; // loading transferReverted

	// The transfer function must meet the precondition, or to revert.
	assert !precondition => (transferReverted || !result), "If transfer() precondition does not hold, must either revert or return 0";
}

function transferCheckEffects(address from, address to, uint256 value, uint256 expectedValueChange)
{
	require to != 0;
	require value != 0;

	env e;
	require e.msg.sender == from;
    uint256 origBalanceOfFrom = balanceOf(from);
    uint256 origBalanceOfTo = balanceOf(to);
	bool result = transfer(e, to, value);
	
	uint256 newBalanceOfTo = balanceOf(to);
	uint256 newBalanceOfFrom = balanceOf(from);

	// Compute the expected new balance.
	uint expectedNewBalanceOfTo;
	uint expectedNewBalanceOfFrom;
	if  (from != to && result) {
		require expectedNewBalanceOfTo == origBalanceOfTo + expectedValueChange;
		require expectedNewBalanceOfFrom == origBalanceOfFrom - expectedValueChange;
	} else {
		require expectedNewBalanceOfTo == origBalanceOfTo;
		require expectedNewBalanceOfFrom == origBalanceOfFrom;
	}
	
	// Effects: new balance of recipient is as expected, and it should also be not less than the original balance
	assert newBalanceOfTo == expectedNewBalanceOfTo && newBalanceOfTo >= origBalanceOfTo, "invalid new balance of to";
	assert newBalanceOfFrom == expectedNewBalanceOfFrom && newBalanceOfFrom <= origBalanceOfFrom, "invalid new balance of from";
}

function _nonRebasingToNonRebasingTransferCheckEqualRatios(address from, address to, uint ratio) {
	require !isRebasing(from) && !isRebasing(to);
	uint256 amount;
	// probably required:
	require nonRebasingCreditsPerToken(from) == nonRebasingCreditsPerToken(to);
	// simplification
	require nonRebasingCreditsPerToken(from) == ratio;
	
	// check:
	transferCheckEffects(from, to, amount, amount);
}

rule nonRebasingToNonRebasingTransferCheckEqualRatios(address from, address to) {
	_nonRebasingToNonRebasingTransferCheckEqualRatios(from, to, 1);
	_nonRebasingToNonRebasingTransferCheckEqualRatios(from, to, ONE());
	assert true; // assertions are in transferCheckEffects
}

function _rebasingToRebasingTransferSimplified(address from, address to, uint ratio) {
	require isRebasing(from) && isRebasing(to);
	uint256 amount;
	// simplification:
	require rebasingCreditsPerToken() == ratio;
	
	// check:
	transferCheckEffects(from, to, amount, amount);
}

rule rebasingToRebasingTransferSimplified(address from, address to) {
	_rebasingToRebasingTransferSimplified(from, to, 1);
	_rebasingToRebasingTransferSimplified(from, to, ONE());
	assert true; // assertions are in transferCheckEffects
}

rule rebasingToRebasingTransfer(address from, address to) {
	require isRebasing(from) && isRebasing(to);
	uint256 amount;
	
	// check:
	transferCheckEffects(from, to, amount, amount);
	assert true; // assertions are in transferCheckEffects
}

// TODO
/*
rule preserveSumOfRebasingCredits {
	// if we change two addresses credits balance, and both are rebasing, the amount of rebasing credits should be the same
	//TODO(expect to be true, because ratios for two addresses are the same)
	
	assert false, "TODO";
}

rule preserveNonRebasingSupply {
	// if we change two addresses credits balance, and both are non-rebasing, the non rebasing supply should be the same
	//TODO(expect to be wrong - if the ratios are different, and I transfer to someone with a lower ratio, some credits are lost. The reverse direction is also true. The trick here is that nonRebasingSupply is denominated in OUSD rather than credits!)
	// So if I have Alice with a ratio of 1, and Bob with a ratio of 100,  and Alice transfers 1000 tokens to Bob, then Bob gets 1000*100 tokens which are a 1000 tokens. So sums of balanceOfs should be still equal if the ratios are stable. The credits are not preserving the sum though.
	
	assert false, "TODO";
}
*/

invariant optingInAndOutSyncdWithNonRebasingState(address a) 
	(rebaseState(a) == OPT_IN() => nonRebasingCreditsPerToken(a) == 0) &&
	(rebaseState(a) == OPT_OUT() => nonRebasingCreditsPerToken(a) > 0) // otherwise - no need to check

rule isRebasingPredicateSynchronized(address a) {
	requireInvariant optingInAndOutSyncdWithNonRebasingState;
	
	uint256 _previousNonRebasingCreditsPerToken = nonRebasingCreditsPerToken(a);
	
	bool becomesNonRebasing = Certora_isNonRebasingAccount(a);
	// the only thing we can say for sure here is that if it was non rebasing, then it remains non rebasing
	if (_previousNonRebasingCreditsPerToken > 0) {
		assert becomesNonRebasing;
	} // can't say anything else because a contract will be migrated.
	
	// after we call _isNonRebasingAccount, and it returns true, it must be the case that nonRebasingCreditsPerToken is positive.
	if (becomesNonRebasing) {
		assert nonRebasingCreditsPerToken(a) > 0;
	} else {
		assert nonRebasingCreditsPerToken(a) == 0;
	}
}

rule onceRebaseStateWasSelectedCannotUnsetIt(address a, method f) {
	uint8 _rebaseState = rebaseState(a);
	bool _isSet = _rebaseState == OPT_IN() || _rebaseState == OPT_OUT();
	
	executeAFunction(f);
	
	uint8 rebaseState_ = rebaseState(a);
	bool isSet_ = rebaseState_ == OPT_IN() || rebaseState_ == OPT_OUT();
	assert _isSet => isSet_, "If opted-in or out before executing a function, it must still be an explicit state of opting in or out afterwards";
}


function executeAFunctionWithSpecificSender(address x, method f) {
	env e;
	require e.msg.sender == x;
	calldataarg arg;
	if (f.selector == init_state().selector) {
		require false; // this is a harness
	} else {
		sinvoke f(e, arg);
	}
}

function executeAFunction(method f) {
	env e;
	calldataarg arg;
	if (f.selector == init_state().selector) {
		require false; // this is a harness
	} else {
		sinvoke f(e, arg);
	}
}

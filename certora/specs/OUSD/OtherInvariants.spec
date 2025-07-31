import "./common.spec";
import "./AccountInvariants.spec";
import "./BalanceInvariants.spec";

use invariant sumAllNonRebasingBalancesEqNonRebasingSupply;
use invariant sumAllRebasingCreditsEqRebasingCredits;

/// @title Verify account balance integrity based on rebase state
// Ensures balances are correctly calculated for Yield Delegation Targets, Standard Rebasing, 
// Non-Rebasing, and undefined (NotSet) states to maintain consistency in OUSD accounting.
/// @property Balance Integrities
rule balanceOfIntegrity(address account) {
	env e;
	initTotalSupply();
	allAccountValidState();
	require OUSD.rebasingCreditsPerToken_ >= e18();

	OUSD.RebaseOptions accountState = OUSD.rebaseState[account];

	address delegator = OUSD.yieldFrom[account];
	uint256 balance = balanceOf(account);
	uint256 delegatorBalance = balanceOf(delegator);

	mathint baseBalance = (OUSD.creditBalances[account] * e18()) / OUSD.rebasingCreditsPerToken_;

	if (accountState == YieldDelegationTarget()) {
		assert balance + delegatorBalance == baseBalance;
	} else if (accountState == NotSet() || accountState == StdRebasing()) {
		assert balance == baseBalance;
	} else if (accountState == StdNonRebasing()) {
		assert balance == OUSD.creditBalances[account];
	}
	assert true;
}

/// @title After a non-reverting call to rebaseOptIn() the alternativeCreditsPerToken[account] == 0 and does not result in a change in account balance.
/// @property Balance Integrities
rule rebaseOptInIntegrity() {
	env e;
	address account = e.msg.sender;
	initTotalSupply();
	allAccountValidState();
	require OUSD.rebasingCreditsPerToken_ >= e18();

	uint256 balancePre = OUSD.balanceOf(account);

	OUSD.rebaseOptIn(e);

	uint256 balancePost = OUSD.balanceOf(account);

	assert OUSD.alternativeCreditsPerToken[account] == 0;
	assert balancePre == balancePost;
}

/// @title After a non-reverting call to governanceRebaseOptIn() the alternativeCreditsPerToken[account] == 0 and does not result in a change in account balance.
/// @property Balance Integrities
rule governanceRebaseOptInIntegrity(address account) {
	env e;
	initTotalSupply();
	allAccountValidState();
	require OUSD.rebasingCreditsPerToken_ >= e18();

	uint256 balancePre = OUSD.balanceOf(account);

	OUSD.governanceRebaseOptIn(e, account);

	uint256 balancePost = OUSD.balanceOf(account);

	assert OUSD.alternativeCreditsPerToken[account] == 0;
	assert balancePre == balancePost;
}

/// @title After a non-reverting call to rebaseOptOut() the alternativeCreditsPerToken[account] == 1e18 and does not result in a change in account balance.
/// @property Balance Integrities
rule rebaseOptOutIntegrity() {
	env e;
	address account = e.msg.sender;
	initTotalSupply();
	allAccountValidState();

	uint256 balancePre = OUSD.balanceOf(account);

	OUSD.rebaseOptOut(e);

	uint256 balancePost = OUSD.balanceOf(account);

	assert OUSD.alternativeCreditsPerToken[account] == e18();
	assert balancePre == balancePost;
}

/// @title Only transfer, transferFrom, mint, burn, and changeSupply result in a change in any account's balance.
/// @property Balance Integrities
rule whoCanChangeBalance(method f, address account) {
	env e;
	calldataarg args;
	initTotalSupply();
	allAccountValidState();
	require OUSD.rebasingCreditsPerToken_ >= e18();
	require isInitialized();

	uint256 balancePre = OUSD.balanceOf(account);

		f(e, args);

	uint256 balancePost = OUSD.balanceOf(account);

	assert balancePre != balancePost => whoCanChangeBalance(f);
}

/// @title A successful mint() call by the vault results in the target account's balance increasing by the amount specified.
/// @property Balance Integrities
rule mintIntegrity(address account, uint256 amount) {
	env e;
	initTotalSupply();
	allAccountValidState();
	require OUSD.rebasingCreditsPerToken_ >= e18();

	uint256 balancePre = OUSD.balanceOf(account);

		mint(e, account, amount);

	uint256 balancePost = OUSD.balanceOf(account);

	assert balancePost == balancePre + amount;
}

/// @title A successful burn() call by the vault results in the target account's balance decreasing by the amount specified.
/// @property Balance Integrities
rule burnIntegrity(address account, uint256 amount) {
	env e;
	initTotalSupply();
	allAccountValidState();
	require OUSD.rebasingCreditsPerToken_ >= e18();

	uint256 balancePre = OUSD.balanceOf(account);

		burn(e, account, amount);

	uint256 balancePost = OUSD.balanceOf(account);

	assert balancePost == balancePre - amount;
}

/// @title After a call to changeSupply() then nonRebasingCredits + (rebasingCredits / rebasingCreditsPer) <= totalSupply and the new totalSupply match what was passed into the call.
/// @property Balance Integrities
rule changeSupplyIntegrity(uint256 newTotalSupply) {
	env e;
	initTotalSupply();
	allAccountValidState();
	requireInvariant sumAllNonRebasingBalancesEqNonRebasingSupply();
	requireInvariant sumAllRebasingCreditsEqRebasingCredits();
	require OUSD.rebasingCreditsPerToken_ >= e18();
	require newTotalSupply >= OUSD.totalSupply();
	/// If garbage in, then garbage out
	require (nonRebasingSupply() + (rebasingCreditsHighres() / OUSD.rebasingCreditsPerToken_)) <= OUSD.totalSupply();
	require OUSD.totalSupply() < MAX_TOTAL_SUPPLY();

	OUSD.changeSupply(e, newTotalSupply);

	assert newTotalSupply < MAX_TOTAL_SUPPLY() ? OUSD.totalSupply() == newTotalSupply : OUSD.totalSupply == MAX_TOTAL_SUPPLY();
	assert (nonRebasingSupply() + (rebasingCreditsHighres() / OUSD.rebasingCreditsPerToken_)) <= OUSD.totalSupply();
}

/// @title Only transfers, mints, and burns change the balance of StdNonRebasing and YieldDelegationSource accounts.
/// @property Balance Integrities
rule whoCanChangeNonRebasingBalance(method f, address account) {
	env e;
	calldataarg args;
	initTotalSupply();
	allAccountValidState();
	require OUSD.rebasingCreditsPerToken_ >= e18();
	require isInitialized();

	uint256 balancePre = OUSD.balanceOf(account);

		f(e, args);

	uint256 balancePost = OUSD.balanceOf(account);
	OUSD.RebaseOptions statePost = OUSD.rebaseState[account];

	assert balancePre != balancePost && (statePost == StdNonRebasing() || statePost == YieldDelegationSource()) => 
				f.selector == sig:transfer(address, uint256) .selector ||
				f.selector == sig:transferFrom(address, address, uint256).selector ||
				f.selector == sig:mint(address, uint256).selector ||
				f.selector == sig:burn(address, uint256).selector;
}

/// @title Recipient and sender (msg.sender) account balances should increase and decrease respectively by the amount after a transfer operation 
// Account balance should not change after a transfer operation if the recipient is the sender.
/// @property Balance Integrities
rule transferIntegrityTo(address account, uint256 amount) {
    env e;
    require sufficientResolution();
    allAccountValidState();
    initTotalSupply();
    
    uint256 toBalanceBefore = balanceOf(account);
    uint256 fromBalanceBefore = balanceOf(e.msg.sender);

    transfer(e, account, amount);

    uint256 toBalanceAfter = balanceOf(account);
    uint256 fromBalanceAfter = balanceOf(e.msg.sender);

    assert account != e.msg.sender => toBalanceAfter - toBalanceBefore == amount;
	assert account != e.msg.sender => fromBalanceBefore - fromBalanceAfter == amount;
    assert account == e.msg.sender => toBalanceBefore == toBalanceAfter;
}

/// @title Transfer doesn't change the balance of a third party.
/// @property Balance Integrities
rule transferThirdParty(address account) {
    env e;
    address to;
    uint256 amount;

    uint256 otherBalanceBefore = balanceOf(account);
    require sufficientResolution();

    // requiring proved invariants
    allAccountValidState();
    initTotalSupply();

    transfer(e, to, amount);
    uint256 otherUserBalanceAfter = balanceOf(account);

    assert (e.msg.sender != account && to != account) => otherBalanceBefore == otherUserBalanceAfter;
}

/// @title Account balance should be increased by the amount minted.
/// @property Balance Integrities
rule mintIntegrityTo(address account, uint256 amount) {
    env e;
    uint256 balanceBefore = balanceOf(account);

    // assumption for the known rounding error that goes like ~ 10^18 / rebasingCreditsPerToken_
    require sufficientResolution();

    // requiring proved invariants
    allAccountValidState();
    initTotalSupply();

    mint(e, account, amount);

    uint256 balanceAfter = balanceOf(account);

    assert balanceAfter - balanceBefore == amount;
}

/// @title Any third-party account balance should not change after a mint operation.
/// @property Balance Integrities
rule mintIntegrityThirdParty(address account) {
    env e;
    address to;
    uint256 amount;
    
    uint256 otherBalanceBefore = balanceOf(account);

    // assumption for the known rounding error that goes like ~ 10^18 / rebasingCreditsPerToken_
    require sufficientResolution();

    // requiring proved invariants
    allAccountValidState();
    initTotalSupply();

    mint(e, to, amount);

    uint256 otherBalanceAfter = balanceOf(account);

    assert to != account => otherBalanceBefore == otherBalanceAfter;
}

/// @title Account balance should be decreased by the amount burned.
/// @property Balance Integrities
rule burnIntegrityTo(address account, uint256 amount) {
    env e;
    
    uint256 balanceBefore = balanceOf(account);

    // assumption for the known rounding error that goes like ~ 10^18 / rebasingCreditsPerToken_
    require sufficientResolution();

    // requiring proved invariants
    allAccountValidState();
    initTotalSupply();

    burn(e, account, amount);

    uint256 balanceAfter = balanceOf(account);

    assert balanceBefore - balanceAfter == amount;
}

/// @title Any third-party account balance should not change after a burn operation.
/// @property Balance Integrities
rule burnIntegrityThirdParty(address account) {
    env e;
    address to;
    uint256 amount;
    
    uint256 otherBalanceBefore = balanceOf(account);

    // assumption for the known rounding error that goes like ~ 10^18 / rebasingCreditsPerToken_
    require sufficientResolution();

    // requiring proved invariants
    allAccountValidState();
    initTotalSupply();

    burn(e, to, amount);

    uint256 otherBalanceAfter = balanceOf(account);

    assert to != account => otherBalanceBefore == otherBalanceAfter;
}

using OUSD as OUSD;

methods {
    function OUSD.yieldTo(address) external returns (address) envfree;
    function OUSD.yieldFrom(address) external returns (address) envfree;
    function OUSD.totalSupply() external returns (uint256) envfree;
    function OUSD.rebasingCreditsPerTokenHighres() external returns (uint256) envfree;
    function OUSD.rebasingCreditsPerToken() external returns (uint256) envfree;
    function OUSD.rebasingCreditsHighres() external returns (uint256) envfree;
    function OUSD.rebasingCredits() external returns (uint256) envfree;
    function OUSD.balanceOf(address) external returns (uint256) envfree;
    function OUSD.creditsBalanceOf(address) external returns (uint256,uint256) envfree;
    function OUSD.creditsBalanceOfHighres(address) external returns (uint256,uint256,bool) envfree;
    function OUSD.nonRebasingCreditsPerToken(address) external returns (uint256) envfree;
    function OUSD.transfer(address,uint256) external returns (bool);
    function OUSD.transferFrom(address,address,uint256) external returns (bool);
    function OUSD.allowance(address,address) external returns (uint256) envfree;
    function OUSD.approve(address,uint256) external returns (bool);
    function OUSD.mint(address,uint256) external;
    function OUSD.burn(address,uint256) external;
    function OUSD.governanceRebaseOptIn(address) external;
    function OUSD.rebaseOptIn() external;
    function OUSD.rebaseOptOut() external;
    function OUSD.changeSupply(uint256) external;
    function OUSD.delegateYield(address, address) external;
    function OUSD.undelegateYield(address) external;
    function rebaseState(address) external returns (OUSD.RebaseOptions) envfree;
    function nonRebasingSupply() external returns (uint256) envfree;
}

definition e18() returns uint256 = 1000000000000000000; // definition for 1e18 

definition MIN_TOTAL_SUPPLY() returns mathint = 10^16;
definition MAX_TOTAL_SUPPLY() returns mathint = 2^128 - 1;

// RebaseOptions state definitions
definition NotSet() returns OUSD.RebaseOptions = OUSD.RebaseOptions.NotSet;
definition StdRebasing() returns OUSD.RebaseOptions = OUSD.RebaseOptions.StdRebasing;
definition StdNonRebasing() returns OUSD.RebaseOptions = OUSD.RebaseOptions.StdNonRebasing;
definition YieldDelegationTarget() returns OUSD.RebaseOptions = OUSD.RebaseOptions.YieldDelegationTarget;
definition YieldDelegationSource() returns OUSD.RebaseOptions = OUSD.RebaseOptions.YieldDelegationSource;

function initTotalSupply() { require totalSupply() >= MIN_TOTAL_SUPPLY(); }

definition sufficientResolution() returns bool = rebasingCreditsPerToken() >= e18();

definition EqualUpTo(mathint A, mathint B, mathint TOL) returns bool = 
	A > B ? A - B <= TOL : B - A <= TOL;

definition BALANCES_TOL() returns mathint = 2;

// p = rebasingCreditsPerToken_
definition BALANCE_ERROR(uint256 p) returns mathint = e18() / p;

definition BALANCE_ROUNDING_ERROR(uint256 p) returns mathint = p / e18();

definition isInitialized() returns bool = OUSD.vaultAddress != 0;

definition whoCanChangeBalance(method f) returns bool = 
    f.selector == sig:transfer(address, uint256).selector ||
    f.selector == sig:transferFrom(address, address, uint256).selector ||
    f.selector == sig:mint(address, uint256).selector ||
    f.selector == sig:burn(address, uint256).selector ||
    f.selector == sig:changeSupply(uint256).selector ||
    false;

definition isRebasing(OUSD.RebaseOptions state) returns bool = 
	state == NotSet() ||
	state == StdRebasing() ||
	state == YieldDelegationTarget() ||
	false;

definition differentAccounts(address accountA, address accountB) returns bool = 
	/// Account have different identities
	(accountA != accountB) &&
	/// The yield target of accountA is not accountB
	(OUSD.rebaseState[accountA] == YieldDelegationSource() => OUSD.yieldTo[accountA] != accountB) &&
	/// The yield source of accountA is not accountB
	(OUSD.rebaseState[accountA] == YieldDelegationTarget() => OUSD.yieldFrom[accountA] != accountB);

definition threeDifferentAccounts(address accountA, address accountB, address accountC) returns bool = 
    differentAccounts(accountA, accountB) &&
    differentAccounts(accountA, accountC) &&
    differentAccounts(accountB, accountC);

definition transferMethods(method f) returns bool = 
	f.selector == sig:transfer(address,uint256).selector ||
	f.selector == sig:transferFrom(address,address,uint256).selector;

definition delegateMethods(method f) returns bool = 
	f.selector == sig:undelegateYield(address).selector ||
	f.selector == sig:delegateYield(address,address).selector;
    
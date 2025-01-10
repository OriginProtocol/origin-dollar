# OUSD Token: Version 4.0

We are revamping the our rebasing token contract.

The primary objective is to allow delegated yield. Delegated yield allows an account to seamlessly transfer all earned yield to another account.

Secondarily, we'd like to fix the tiny rounding issues around both transfers and local account information vs global tracking variables.


## How OUSD works.

OUSD is a rebasing token. Its mission in life is to be able to distribute increases in backing assets on to users by having user's balances go up each time the token rebases. 

**`_rebasingCreditsPerToken`** is a global variable that converts between "credits" stored on a account, and the actual balance of the account. This allows this single variable to be updated and in turn all "rebasing" users have their account balance change proportionally. Counterintuitively, this is not a multiplier on users credits, but a divider. So it's `user balance = user credits / _rebasingCreditsPerToken`. Because it's a divider, OUSD will slowly lose resolution over very long timeframes, as opposed to  abruptly stopping working suddenly once enough yield has been earned.

**_creditBalances[account]** This per account mapping stores the internal credits for each account.

**alternativeCreditsPerToken[account]** This per account mapping stores an alternative, optional conversion factor for the value used in creditBalances. When it is set to zero, it means that it is unused, and the global `_rebasingCreditsPerToken` should be used instead. Because this alternative conversion factor does not update on rebases, it allows an account to be "frozen" and no longer change balances as rebases happen.

**rebaseState[account]** This holds user preferences for what type of accounting is used on an account. For historical reasons the default, `NotSet` value on this could mean that the account is using either `StdRebasing` or `StdNonRebasing` accounting (see details later).

**totalSupply** Notationally the sum of all account balances.

## Account Types

There are four account types in the system. 

The new code is more explicit in its writes than the old code. Thus there's two sections for each type, the old values that could be read, and the format of the new values that the new code writes.

### StdRebasing Account (Default)

This is the "normal" account in the system. It receives yield and its balance goes up over time. Almost every account is of this type.

Reads:

- `rebaseState`: could be either `NotSet` or `StdRebasing`. Almost all accounts are `NotSet`, and typically only contracts that want to receive yield are set to `StdRebasing` (though there's nothing preventing regular users from explicitly marking their account as receiving yield).
- `alternativeCreditsPerToken`: will always be zero, thus using the global _rebasingCreditsPerToken
- `_creditBalances`: credits for the account

Writes:

- `rebaseState`: if explicitly moving to this state from another state `StdRebasing` is set. Otherwise, the account remains `NotSet`.
- `alternativeCreditsPerToken`: will always be zero
- `_creditBalances`: credits for the account

Transitions to:

- automatic conversion to a `StdNonRebasing` account if funds are moved to or from a contract AND the account is currently `NotSet`.
- to `StdNonRebasing` if the account calls `rebaseOptOut()`
- to `YieldDelegationSource` if the source account in a `delegateYield()` call
- to `YieldDelegationTarget` if it is the destination account in a `delegateYield()`

### StdNonRebasing Account (Default)

This account does not earn yield. It was originally created for backwards compatibility with contracts that did not support non-transfer balance changes, as well as to not waste giving yield to third party contracts that did not support any yield distribution to users.

As a side benefit, because of these contracts, regular users earn at a higher rate than they would otherwise get.

Reads:

- `rebaseState`: could be either `NotSet` or `StdNonRebasing`. Historically, almost all accounts are `NotSet` and you can only determine which kind of account `NotSet` is by looking at `alternativeCreditsPerToken`.
- `alternativeCreditsPerToken` Will always be non-zero. Probably ranges from 1e17-ish to 1e27, with most at 1e27.
- `_creditBalances` will either be a "frozen credits style" that can be converted via `alternativeCreditsPerToken`, or "frozen balance" style, losslessly convertible via an 1e18 or 1e27 in `alternativeCreditsPerToken`.

Writes:

- `rebaseState`: Set to `StdNonRebasing` when new contracts are automatically moved to this state, or when explicitly converted to this account type. This was not previously the case for historical automatic conversions.
- `alternativeCreditsPerToken`: New balance writes will always use 1e18, which will result in the account's credits being equal to the balance.
- `_creditBalances`: New balance writes will always use 1:1 a credits/balance ratio, which will make this be the account balance.

Transitions to:

- to `StdRebasing` via a `rebaseOptIn()` call or a governance `governanceRebaseOptIn()`.
- to `YieldDelegationSource` if the source account in a `delegateYield()` call
- to `YieldDelegationTarget` if it is the destination account in a `delegateYield()`

### YieldDelegationSource

This account does not earn yield, instead its yield is passed on to another account.

It does this by keeping a non-rebasing style fixed balance locally, while storing all its rebasing credits on the target account. This makes the target account's credits be `(target account's credits + source account's credits)`

Reads / Writes (no historical accounts to deal with!):

- `rebaseState`: `YieldDelegationSource`
- `alternativeCreditsPerToken`: Always 1e18.
- `_creditBalances`: Always set to the account balance in 1:1 credits.
- Target account's `_creditBalances`: Increased by this accounts credits at the global `_rebasingCreditsPerToken`. 

Transitions to:
- to `StdNonRebasing` if `undelegateYield()` is called on the yield delegation

### YieldDelegationTarget

This account earns extra yield from exactly one account. YieldDelegationTargets can have their own balances, and these balances to do earn. This works by having both account's credits stored in this account, but then subtracting the other account's fixed balance from the total. 

For example, someone loans you an intrest free $10,000. You now have an extra $10,000, but also owe them $10,000 so that nets out to a zero change in your wealth. You take that $10,000 and invest it in T-bills, so you are now getting more yield than you did before.


Reads / Writes (no historical accounts to deal with!):
- `rebaseState`: `YieldDelegationTarget`
- `alternativeCreditsPerToken`: Always 0
- `_creditBalances`: The sum of this account's credits and the yield sources credits.
- Source account's `_creditBalances`: This balance is subtracted by that value

Transitions to:
- to `StdRebasing` if `undelegateYield()` is called on the yield delegation

## Account invariants


<!-- Invarient -->
> Any account with a zero value in `alternativeCreditsPerToken` has a `rebaseState` that is one of (NotSet, StdRebasing, or YieldDelegationTarget) [^1]

<!-- Invarient -->
> Any account with value of 1e18 in `alternativeCreditsPerToken` has a `rebaseState` that is one of (StdNonRebasing, YieldDelegationSource) [^1]

<!-- Invarient -->
> `alternativeCreditsPerToken` can only be set to 0 or 1e18, no other values [^1]

<!-- Invarient -->
> Any account with `rebaseState` = `YieldDelegationSource` has a nonZero `yieldTo`

<!-- Invarient -->
> Any account with `rebaseState` = `YieldDelegationTarget` has a nonZero `yieldFrom`

<!-- Invarient -->
> Any non zero valued `YieldFrom` points to an account that has a `YieldTo` pointing back to the starting account.

## Balance Invariants

There are four different account types, two of which link to each other behind the scenes. Because of this, checks on overall balances cannot only look at the to / from accounts in a transfer.

<!-- Invarient -->
> No non-vault accounts cannot increase or decrease the sum of all balances. (This covers all actions including optIn/out, and yield delegation, not just transfers) [^2]

<!-- Invarient -->
> The from account in a transfer should have its balance reduced by the amount of the transfer, [^2]

<!-- Invarient -->
> The To account in a transfer should have its balance increased by the amount of the transfer. [^2]

<!-- Invarient -->
> The sum of all account balanceOf's is less or equal to than the totalSupply [^2]

<!-- Invarient -->
> The sum of all `RebaseOptions.StdNonRebasing` accounts equals the nonRebasingSupply. [^1] [^2] 

<!-- Invarient -->
> The sum of the credits in all NotSet, StdRebasing, and YieldDelegationTarget accounts equal the rebasingCredits. [^1]

<!-- Invarient -->
> The balanceOf on each account equals `_creditBalances[account] * (alternativeCreditsPerToken[account] > 0 ? alternativeCreditsPerToken[account] : _rebasingCreditsPerToken) - (yieldFrom[account] == 0 ? 0 : _creditBalances[yieldFrom[account]])`


## Rebasing

The token distributes yield to users by "rebasing" (changing supply). This leaves all non-rebasing users with the same account balance.

The token is designed to gently degrade in resolutions once a huge amount of APY has been earned. Once this crosses a certain point, and enough resolution is no longer possible, transfers should slightly round up.

There is inevitable rounding error when rebasing, since there is no possible way to ensure that totalSupply is exactly the result of all the things that make it up. This is because totalSupply must be exactly equal to the new value and nonRebasingSupply must not change. The only option is to handle rounding errors by rounding down the rebasingCreditsPerToken. The resulting gap of undistributed yield is later distributed to users the next time the token rebases upwards.


## Rebasing invariants

<!-- Invarient -->
> After a call to changeSupply() then `nonRebasingCredits + (rebasingCredits / rebasingCreditsPer) <= totalSupply`

<!-- Invarient -->
> After a non-reverting call to changeSupply(), the new totalSupply should always match what was passed into the call. 

<!-- Invarient -->
> Only transfers, mints, and burns change the balance of `StdNonRebasing` and `YieldDelegationSource` accounts.


## Other invariants

<!-- Invarient -->
> After a non-reverting call to `rebaseOptIn()` the `alternativeCreditsPerToken[account] == 0`

<!-- Invarient -->
> Calling `rebaseOptIn()` does not result in a change in account balance. [^2]

<!-- Invarient -->
> After a non-reverting call to `rebaseOptOut()` the `alternativeCreditsPerToken[account] == 1e18`

<!-- Invarient -->
> Calling `rebaseOptOut()` does not result in a change in account balance.

<!-- Invarient -->
> Only `transfer`, `transferFrom`, `mint`, `burn`, and `changeSupply` result in a change in any account's balance.

<!-- Invarient -->
> A successful mint() call by the vault results in the target account's balance increasing by the amount specified

<!-- Invarient -->
> A successful burn() call by the vault results in the target account's balance decreasing by the amount specified

## External integrations

In production, the following things are true:

- changeSupply can move up only. This is hardcoded into the vault.
- There will aways be 1e16+ dead rebasing tokens (we send them to a dead address at deploy time)





[^1]: From the current code base. Historically there may be different data stored in storage slots.

[^2]: As long as the token has sufficient resolution
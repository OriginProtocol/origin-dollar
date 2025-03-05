# WOETH token

An ERC4626 contract that wraps a rebasing token and allows it to be treated as a non-rebasing value accrual token.

This contract distributes yield slowly over 23 hour periods. This prevents donation attacks against borrowing on lending platforms.

It is designed to work only with up-only rebasing tokens. The asset token must not make reenterable external calls on transfers.



## Invariants

### Yield timing

Yield only can happen at the start of a block, and at most once per block.

> transfers do not change `totalAssets()`

> scheduleYield() does not change `totalAssets()`

> all other actions do not change `totalAssets()`, beyond the OETH transferred to or from the user

> sending OETH to the contract, or positive rebasing from OETH, will not change `totalAssets()`.

Given that this contract only works off of balances, there is no difference from wOETH's point of view between an OETH donation, and an OETH rebase.

### Yield distribution

Yield is distributed evenly per second from the start of a yield period at (`scheduleYield()` + 1) to the end of the period, inclusive.

An example of a three second yield period.

    [   ~    ][Yield][Yield][Yield][     ][     ]
    [schedule][     ][     ][ end ][     ][     ]

> yield given in a second, when yield is active, will be (yieldAssets / YIELD_TIME), with values either rounded down or rounded up possible.

> yield given in a second, when the block timestamp is past the end date, will be 0

Because we operate on blockchains with many different block times, the per block yields may vary depending on how many active yield seconds elapse in each.

### Solvency

The protocol rounds against the user, in favor of the protocol

> Any series of actions by a single user in a single block followed by a withdraw, will not result in an increase in their (OETH + previewRedeem(balance))[1]

> At any time, all users of the system can redeem all their wOETH

> The actual redeem amounts will match previewRedeem()[1]

> `previewRedeem()` will never go down, outside of an external loss of OETH balance

> The sum of `userAssets + yieldAssets` will never exceed wOETH's balance of OETH, outside of an external loss of OETH balance

> The sum of `totalAssets()` will never exceed wOETH's balance of OETH, outside of an external loss of OETH balance

### 4626-ness

This is an ERC 4626, as such it should follow correct behaviors for an ERC4626.


[1] When OETH has sufficient transfer resolution.
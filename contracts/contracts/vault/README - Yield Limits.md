# Vault Yield Limits

The vault does not necessarily rebase out all the value that it contains to the token on every rebase. Instead, the vault controls the maximum amount it rebases at one time. 

This limiting behavior protects against donation attacks against other protocols. Some lending platforms don't handle sudden value change well. 

 Secondly, it allows us to smoothly distribute yield over time. One example is that if we do a big sale of airdropped reward tokens, it would be much better if that yield was spread out over a longer period than just one block. Because this rate is controlled by the strategist, it can be set to a high rate to only block donation attacks, but not smooth regular yield, to a middle rate to only smooth extraordinary yield over a some blocks, or a low rate to set the protocols APR to end users, and provide a predictable APY.

 ### How it works

 The vault value available is the lowest of three values:

 - Actual vault value
 - Hard max maximum growth per rebase
 - A sloped max that increases at a rate per second


 ```

                 rebase max -> .- - - -
                               .     
                               .    /
- - - .------------------------'   / <- per second cap
     /   ^ rebase max             /
    /                            /  .-
   /<- per second cap .---------*---' 
  /                   .         ^
 /       .------------'       rebase
*--------'  ^ vault value 
^
rebase
````

The rebase limit operates like a bucket based rate limiter. Every second more limit is added to bucket, and once the bucket is full it cannot store more limit. This means that yield in amounts under the limit bucket amount are distributed instantly, while yield above become available over time at the per second rate.

The hard max rebase cap and the over time cap are both needed. Without the hard cap, someone could just wait until there had been a long enough period between rebases, and then make a large donation that would use the by now very large bucket. Without the slope cap, someone could just call rebase repeatedly, and repeatedly rebase out the yield.

The limit bucket does not work off absolute value amounts, but rather off allowed change percentages. This means that a change in supply does not alter the rates when expressed as percentage of growth over time.  Otherwise, someone redeeming tokens with a fixed dollar amount yield, would increase the effective rate of yield, thus bypassing the caps.

When setting the rate limit, the limit should be set appropriately higher than what is desired for end users to experience, since this rate limiting is done before fees are taken out and the fees are taken out of what is distributed to end users.

The maximum possible values for the per rebase cap, and the per second cap are set such that they should be over safe for lending platforms, and yet allow the flexibility for large yields in the face of triple digit inflation of the underlying token.

### Drip Duration and Target Rate

In `_nextYield` function of VaultCore there is a the yield dripping is enforced if `_dripDuration > 1`. This explains how it works

Target rate is being limited by the higher yield/dripDuration rate and a lower yield/(dripDuration*2). If previous target rate is within those limits the existing targetRate is kept. If the previous target rate is outside those limits, the limits are enforced.
```
                                    - - - - - - -'
                                    .            .
                         - - - - - -'            .
                         .                       .
- - - - - - - - - - - - -'                       '- - - - - -'
^ yield /                                                    .
_dripDuration                        ------------*-----------*
                      rebase         .           .           .
-------------------------*-----------*           .           '----------
^ rebasePerSecondTarget  - - - - - - '           .
                         .                       .
- - - - - - - - - - - - -'                       - - - - - - '
^ yield /                                                    .
(_dripDuration * 2)                                          .
                                                             '- - - - -
```

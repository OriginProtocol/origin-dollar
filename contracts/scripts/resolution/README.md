# Resolution Upgrade Process



## Upgrade Steps


1) Run deploy 24_resolution_upgrade_start

2) Governance action to execute proposal, switching OUSD into upgrade mode.

3) Download list of all accounts that have ever owned OUSD, from analytics.

    curl https://analytics.ousd.com/api/v1/address/ > scripts/resolution/addresses.json

4) Check all accounts, make a list of accounts to upgrade:

Locally run:

    HARDHAT_NETWORK=mainnet \
      node scripts/resolution/verify.js
      --addressesFile=scripts/resolution/addresses.json \
      --upgradeFile=scripts/resolution/upgrade.json \
      --highres

Save the output of this script, for later comparison. Make sure totals roughly match OUSD analytics.

5) Now upgrade accounts:

To get this over with quickly, it uses batchs of 120 accounts each, ( about 3,700,000 gas per TX). There are approximately 2,000 accounts to upgrade.

If you wish for smaller batch sizes, there's a constant in the file you can edit.

    HARDHAT_NETWORK=mainnet \
    node scripts/resolution/upgrade.js \
    --upgradeFile=scripts/resolution/upgrade.json \
    --upgradeGlobals

If the upgrade script fail part way, you will need to rerun the verification script to decided which accounts to upgrade. Then rerun, but remove `--upgradeGlobals` if that has already been run.

6) Verify again:

    HARDHAT_NETWORK=mainnet \
      node scripts/resolution/verify.js
      --addressesFile=scripts/resolution/addresses.json \
      --upgradeFile=scripts/resolution/upgrade.json \
      --highres

Totals should still match OUSD analytics, no accounts should need to be upgraded.

Multiple people can run this and verify.

6) Verify creditsPerTokenHighres on etherscan, to ensure that the global upgrade ran.

Whole upgrade team should test also balanceOf several random accounts as further check.

7) Run deploy 25_resolution_upgrade_end.

8) Execute second governance action.

9) Celebrate, after an appropreate period of skeptiscim and doubt.


## Local resolution upgrade testing

For local testing of the new transfer behavior, you can gererate a list of transfers between accounts:

    node scripts/resolution/testSequenceCreate.js \
    --testFile=scripts/resolution/test.json \
    --upgradeFile=scripts/resolution/upgrade.json

Then, you can run the approximately 1,000 transfers as tests against a fork. Each balance before and afer is checked against the amount transfers, and any balance discrepencies are shown.

    HARDHAT_NETWORK=mainnet \
    node scripts/resolution/testSequenceRun.js \
    --testFile=scripts/resolution/test.json

You can run this same command on both a local fork before the update, and a seperate local fork after the upgrade has run.
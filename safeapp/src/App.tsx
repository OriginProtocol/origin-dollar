import React, { useCallback, useState, useEffect } from 'react';
import styled from 'styled-components';
import { Button, Loader, Title } from '@gnosis.pm/safe-react-components';
import { useSafeAppsSDK } from '@gnosis.pm/safe-apps-react-sdk';
import getNetworkProvider from './utils/provider';
import setupContracts from './utils/contracts';
import {amountToUnits} from './utils/math';
import { Contract } from 'ethers';
import AccountListener from './components/AccountListener';
import AccountStore from './stores/AccountStore'

const Container = styled.form`
  margin-bottom: 2rem;
  width: 100%;
  max-width: 480px;

  display: grid;
  grid-template-columns: 1fr;
  grid-column-gap: 1rem;
  grid-row-gap: 1rem;
`;

const refreshAccount = () => {
  console.log("updating account store.");
    AccountStore.update((s) => {
          s.refetchUserData = true;
          })
}

const App: React.FC = () => {
  const { sdk, safe } = useSafeAppsSDK();
  console.log("origin safe:", safe);
  const [submitting, setSubmitting] = useState(false);
  const [contracts, setContracts] = useState<null|{dai:Contract, ousd:Contract, usdt:Contract, usdc:Contract, vault:Contract}>(null);
  const [account, setAccount] = useState<null|object>(null);
  const balances = AccountStore.useState(s => s.balances);
  const mintAmount = "5"
  
  console.log("current balances:", balances);

  // set provider and contract
  useEffect(() => {
    if (!safe) {
      console.log("No safe available..");
      return;
    }
    console.log("safe initialized");

    const initialize = async () => {
      const np = await getNetworkProvider(safe);
      if (np) {
        console.log("network provider:", np?.provider);
        const c = await setupContracts(np);
        if (c) {
          console.log("We got contracts.",c);
          setAccount(np?.account);
          setContracts(c);
        }
      }
    }

    initialize();
  }, [safe]);

  const redeemAllTx = useCallback(async () => {
    if(!account || !contracts) {
      return;
    }
    setSubmitting(true);
    try {
      const {vault} = contracts
      const params = {
        safeTxGas: 500000
      };
      const { safeTxHash } = await sdk.txs.send({
        txs: [
          {
            to: vault.address, 
            value: '0',
            data: (await vault.populateTransaction['redeemAll'](0)).data!
          }
        ],
      params});
      console.log({ safeTxHash });
      const safeTx = await sdk.txs.getBySafeTxHash(safeTxHash);
      console.log({ safeTx });
      refreshAccount();
    } catch (e) {
      console.error(e);
    }
    setSubmitting(false);
  }, [sdk, contracts, account]);




  const mintTx = (coin:Contract) => {
    if (!coin) {
      return;
    }
    return async () => {
      if(!account || !contracts) {
        return;
      }
      setSubmitting(true);
      try {
        const {vault} = contracts
        const units = await amountToUnits(mintAmount, coin)
        const params = {
          safeTxGas: 500000
        };
        console.log("Coin:", coin.address);
        console.log("vault:", vault.address);
        console.log("amount:", units.toString());
        const { safeTxHash } = await sdk.txs.send({
          txs: [
            {
              to: coin.address,
              value: '0',
              data: (await coin.populateTransaction['approve'](vault.address, units)).data!
            },
            {
              to: vault.address, 
              value: '0',
              data: (await vault.populateTransaction['mint'](coin.address, units, 0)).data!
            }
          ],
        params});
        console.log({ safeTxHash });
        const safeTx = await sdk.txs.getBySafeTxHash(safeTxHash);
        console.log({ safeTx });
        refreshAccount();
      } catch (e) {
        console.error(e);
      }
      setSubmitting(false);
    }
  }


  return (
    <Container>
      <AccountListener account={account} contracts={contracts} />
      <Title size="md">{safe.safeAddress}</Title>
      <div> Dai Balance: {balances.dai} </div>
        {submitting ? (
          <>
            <Loader size="md" />
            <br />
          </>
        ) : (
          <Button size="lg" color="primary" onClick={mintTx(contracts?.dai!)}>
            Mint {mintAmount} Dai
          </Button>
        )}
      <div> USDT Balance: {balances.usdt} </div>
        {submitting ? (
          <>
            <Loader size="md" />
            <br />
          </>
        ) : (
          <Button size="lg" color="primary" onClick={mintTx(contracts?.usdt!)}>
            Mint {mintAmount} usdt
          </Button>
        )}
      <div> USDC Balance: {balances.usdc} </div>
        {submitting ? (
          <>
            <Loader size="md" />
            <br />
          </>
        ) : (
          <Button size="lg" color="primary" onClick={mintTx(contracts?.usdc!)}>
            Mint {mintAmount} usdc
          </Button>
        )}
      <div> OGN Balance: {balances.ogn} </div>
      <div> OUSD Balance: {balances.ousd} </div>
      {(balances.ousd && balances.ousd !== '0.0') && (submitting ? (
          <>
            <Loader size="md" />
            <br />
          </>
        ) : (
          <Button size="lg" color="primary" onClick={redeemAllTx}>
            Redeem All
          </Button>
        ))}
    </Container>
  );
};

export default App;

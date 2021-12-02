import { useEffect, useState, useRef } from 'react'
import { useWeb3React } from '@web3-react/core'
import { useStoreState } from 'pullstate'

import {
  injectedConnector,
  gnosisConnector,
  ledgerConnector,
} from './connectors'
import AccountStore from 'stores/AccountStore'
import analytics from 'utils/analytics'

export function useEagerConnect() {
  const { activate, active } = useWeb3React()

  const connectorName = useStoreState(AccountStore, (s) => s.connectorName)

  const [triedEager, setTriedEager] = useState(false)
  const [triedSafeMultisig, setTriedSafeMultisig] = useState(false)
  const [isSafeMultisig, setIsSafeMultisig] = useState(false)

  // Attempt to use Gnosis Safe Multisig if available
  useEffect(() => {
    async function attemptSafeConnection() {
      if (!process.browser) return

      const gconnector = gnosisConnector()
      // OK to use Gnosis Safe?
      const canUseGnosisSafe = await gconnector.isSafeApp()

      try {
        await activate(gconnector, undefined, true)
      } catch (error) {
        // Outside of Safe context
        console.debug(error)
        setTriedSafeMultisig(true)
        return
      }

      AccountStore.update((s) => {
        s.connectorName = 'Gnosis'
      })

      setIsSafeMultisig(true)
      setTriedSafeMultisig(true)
    }

    attemptSafeConnection()
  }, [process.browser]) // Try this when Safe multisig connector is started

  // Attempt to use injectedConnector connector
  useEffect(() => {
    async function attemptEagerConnection() {
      // Must try Safe multisig before injectedConnector connector, don't do anything
      // further if using Safe multisig
      if (!triedSafeMultisig || isSafeMultisig) return

      const eagerConnect = localStorage.getItem('eagerConnect', false)
      // Local storage request we don't try eager connect
      if (eagerConnect === 'false') return

      if (eagerConnect === 'MetaMask' || eagerConnect === 'true') {
        const canUseInjected =
          !triedEager &&
          injectedConnector &&
          (await injectedConnector.isAuthorized())
        if (!canUseInjected) return

        try {
          await activate(injectedConnector, undefined, true)
        } catch (error) {
          console.debug(error)
          return
        } finally {
          setTriedEager(true)
        }

        AccountStore.update((s) => {
          s.connectorName = 'MetaMask'
        })
      } else if (eagerConnect === 'Ledger') {
        try {
          await ledgerConnector.activate()
          const ledgerDerivationPath = localStorage.getItem(
            'ledgerDerivationPath'
          )
          const ledgerAccount = localStorage.getItem('ledgerAccount')
          if (ledgerDerivationPath) {
            await ledgerConnector.setPath(ledgerDerivationPath)
          }
          if (ledgerAccount) {
            await ledgerConnector.setAccount(ledgerAccount)
          }
          await activate(ledgerConnector, undefined, true)
        } catch (error) {
          console.debug(error)
          return
        } finally {
          setTriedEager(true)
        }
        AccountStore.update((s) => {
          s.connectorName = 'Ledger'
        })
      }
    }
    attemptEagerConnection()
  }, [triedSafeMultisig]) // Try this only after Safe multisig has been attempted

  useEffect(() => {
    if (connectorName) {
      analytics.track('On Connect Wallet', {
        category: 'general',
        label: connectorName,
      })
    }
  }, [connectorName])

  return triedEager
}

export function useInterval(callback, delay) {
  const savedCallback = useRef()

  // Remember the latest callback.
  useEffect(() => {
    savedCallback.current = callback
  }, [callback])

  // Set up the interval.
  useEffect(() => {
    function tick() {
      savedCallback.current()
    }
    if (delay !== null) {
      let id = setInterval(tick, delay)
      return () => clearInterval(id)
    }
  }, [delay])
}

export function usePrevious(value) {
  const ref = useRef()
  useEffect(() => {
    ref.current = value
  })
  return ref.current
}

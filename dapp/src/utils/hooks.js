import { useEffect, useState, useRef } from 'react'
import { useWeb3React } from '@web3-react/core'

import {
  injected,
  connectorsByName,
  getConnector,
  getConnectorImage,
  gnosisConnector,
} from './connectors'
import AccountStore from 'stores/AccountStore'
import analytics from 'utils/analytics'

export function useEagerConnect() {
  const { activate, active } = useWeb3React()

  const [triedInjected, setTriedInjected] = useState(false)
  const [triedSafeMultisig, setTriedSafeMultisig] = useState(false)
  const [connector, setConnector] = useState(null)
  const [connectorIcon, setConnectorIcon] = useState(null)
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

      setConnector(gconnector)
      setConnectorIcon('gnosis-safe-icon.svg')

      setIsSafeMultisig(true)
      setTriedSafeMultisig(true)
    }

    attemptSafeConnection()
  }, [process.browser]) // Try this when Safe multisig connector is started

  // Attempt to use injected connector
  useEffect(() => {
    async function attemptInjectedConnection() {
      // Must try Safe multisig before injected connector, don't do anything
      // further if using Safe multisig
      if (!triedSafeMultisig || isSafeMultisig) return
      // Local storage request we don't try eager connect
      if (localStorage.getItem('eagerConnect') === 'false') return

      // OK to use injected?
      const canUseInjected =
        !triedInjected && injected && (await injected.isAuthorized())
      if (!canUseInjected) return

      try {
        await activate(injected, undefined, true)
      } catch (error) {
        console.debug(error)
        return
      } finally {
        setTriedInjected(true)
      }

      setConnector(injected)
      setConnectorIcon(getConnectorImage(injected))
    }
    attemptInjectedConnection()
  }, [triedSafeMultisig]) // Try this only after Safe multisig has been attempted

  useEffect(() => {
    if (connector && connectorIcon) {
      analytics.track('On Connect Wallet', {
        category: 'general',
        label: connector.name,
      })
      AccountStore.update((s) => {
        s.connectorIcon = connectorIcon
      })
    }
  }, [connector, connectorIcon])

  return triedInjected
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

export function useInactiveListener(suppress = false) {
  const { active, error, activate } = useWeb3React()

  useEffect(() => {
    const { ethereum } = window
    if (ethereum && ethereum.on && !active && !error && !suppress) {
      const handleConnect = () => {
        console.log("Handling 'connect' event")
        activate(injected)
      }
      const handleChainChanged = (chainId) => {
        console.log("Handling 'chainChanged' event with payload", chainId)
        activate(injected)
      }
      const handleAccountsChanged = (accounts) => {
        console.log("Handling 'accountsChanged' event with payload", accounts)
        if (accounts.length > 0) {
          activate(injected)
        }
      }
      const handleNetworkChanged = (networkId) => {
        console.log("Handling 'networkChanged' event with payload", networkId)
        activate(injected)
      }

      ethereum.on('connect', handleConnect)
      ethereum.on('chainChanged', handleChainChanged)
      ethereum.on('accountsChanged', handleAccountsChanged)
      ethereum.on('networkChanged', handleNetworkChanged)

      return () => {
        if (ethereum.removeListener) {
          ethereum.removeListener('connect', handleConnect)
          ethereum.removeListener('chainChanged', handleChainChanged)
          ethereum.removeListener('accountsChanged', handleAccountsChanged)
          ethereum.removeListener('networkChanged', handleNetworkChanged)
        }
      }
    }
  }, [active, error, suppress, activate])
}

export function usePrevious(value) {
  const ref = useRef()
  useEffect(() => {
    ref.current = value
  })
  return ref.current
}

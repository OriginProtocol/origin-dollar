import { useEffect, useState } from 'react'
import { Web3Provider } from '@ethersproject/providers'
import { Web3ReactProvider } from '@web3-react/core'

const withWeb3Provider = (WrappedComponent) => {
  function getLibrary(provider) {
    const library = new Web3Provider(provider)
    library.pollingInterval = 12000
    return library
  }

  const Wrapper = (props) => {
    return (
      <Web3ReactProvider getLibrary={getLibrary}>
        <WrappedComponent {...props} />
      </Web3ReactProvider>
    )
  }

  if (WrappedComponent.getInitialProps) {
    Wrapper.getInitialProps = async (ctx) => {
      const componentProps = await WrappedComponent.getInitialProps(ctx)
      return componentProps
    }
  }

  return Wrapper
}

export default withWeb3Provider

import React, { useEffect, useState } from 'react'
import { AccountStore } from 'stores/AccountStore'

const withLoginModal = (WrappedComponent) => {
  const Wrapper = (props) => {
    const showLogin = () => {
      AccountStore.update((s) => {
        s.showLoginModal = true
      })
    }
    return <WrappedComponent {...props} showLogin={showLogin} />
  }

  if (WrappedComponent.getInitialProps) {
    Wrapper.getInitialProps = async (ctx) => {
      const componentProps = await WrappedComponent.getInitialProps(ctx)
      return componentProps
    }
  }

  return Wrapper
}

export default withLoginModal

import React, { useEffect, useState } from 'react'

const withIsMobile = (WrappedComponent) => {
  const Wrapper = (props) => {
    const [isMobile, setIsMobile] = useState(
      process.browser ? window.innerWidth < 768 : false
    )

    const onResize = () => {
      if (window.innerWidth < 768 && !isMobile) {
        setIsMobile(true)
      } else if (window.innerWidth >= 768 && isMobile) {
        setIsMobile(false)
      }
    }

    useEffect(onResize, [])
    useEffect(() => {
      window.addEventListener('resize', onResize)

      const unsubscribe = () => {
        window.removeEventListener('resize', onResize)
      }
      return unsubscribe
    }, [])

    return (
      <WrappedComponent
        {...props}
        isMobile={isMobile}
        isMobileApp={
          process.browser
            ? typeof window.ReactNativeWebView !== 'undefined'
            : false
        }
      />
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

export default withIsMobile

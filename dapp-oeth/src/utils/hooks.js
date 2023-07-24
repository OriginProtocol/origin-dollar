import { useEffect, useRef } from 'react'
import { useRouter } from 'next/router'
import { ethers } from 'ethers'

export function usePrevious(value) {
  const ref = useRef()
  useEffect(() => {
    ref.current = value
  })
  return ref.current
}

export function useOverrideAccount() {
  const {
    query: { override_account },
    pathname,
  } = useRouter()
  const isValid =
    override_account && !ethers.utils.isAddress(override_account) ? false : true
  const overrideAccount =
    pathname === '/history' && override_account && isValid
      ? override_account
      : null

  return { overrideAccount: overrideAccount, isValid: isValid }
}

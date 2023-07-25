import { useCallback, useEffect, useState } from 'react'

const LOCAL_STORAGE_CHANGE_EVENT_NAME = 'onLocalStorageChange'

const isTypeOfLocalStorageChanged = (evt) => {
  return !!evt && evt.type === LOCAL_STORAGE_CHANGE_EVENT_NAME
}

const isBrowser = () => {
  return typeof window !== 'undefined' && typeof window.document !== 'undefined'
}

const writeStorage = (key, value) => {
  if (!isBrowser()) {
    return
  }

  try {
    window.localStorage.setItem(
      key,
      typeof value === 'object' ? JSON.stringify(value) : `${value}`
    )
    window.dispatchEvent(
      new CustomEvent(LOCAL_STORAGE_CHANGE_EVENT_NAME, {
        detail: { key, value },
      })
    )
  } catch (err) {
    if (
      err instanceof TypeError &&
      err.message.includes('circular structure')
    ) {
      throw new TypeError(
        'The object that was given to the writeStorage function has circular references.\n' +
          'For more information, check here: ' +
          'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Errors/Cyclic_object_value'
      )
    }
    throw err
  }
}

const deleteFromStorage = (key) => {
  if (!isBrowser()) {
    return
  }
  window.localStorage.removeItem(key)
  window.dispatchEvent(
    new CustomEvent(LOCAL_STORAGE_CHANGE_EVENT_NAME, {
      detail: { key, value: null },
    })
  )
}

const tryParse = (value) => {
  try {
    return JSON.parse(value)
  } catch {
    return value
  }
}

const useLocalStorage = (key, defaultValue) => {
  const [localState, updateLocalState] = useState(
    window.localStorage.getItem(key) === null
      ? defaultValue
      : tryParse(window.localStorage.getItem(key))
  )

  const onLocalStorageChange = useCallback(
    (event) => {
      if (isTypeOfLocalStorageChanged(event)) {
        if (event.detail.key === key) {
          updateLocalState(event.detail.value)
        }
      } else {
        if (event.key === key) {
          updateLocalState(
            event.newValue === null ? null : tryParse(event.newValue)
          )
        }
      }
    },
    [updateLocalState, key]
  )

  useEffect(() => {
    if (!isBrowser()) {
      return
    }

    const listener = (e) => {
      onLocalStorageChange(e)
    }

    window.addEventListener(LOCAL_STORAGE_CHANGE_EVENT_NAME, listener)

    // The storage event only works in the context of other documents (eg. other browser tabs)
    window.addEventListener('storage', listener)

    // Write default value to the local storage if there currently isn't any value there.
    if (window.localStorage.getItem(key) === null && defaultValue !== null) {
      writeStorage(key, defaultValue)
    }

    return () => {
      window.removeEventListener(LOCAL_STORAGE_CHANGE_EVENT_NAME, listener)
      window.removeEventListener('storage', listener)
    }
  }, [key, defaultValue, onLocalStorageChange])

  const writeState = useCallback(
    (value) =>
      value instanceof Function
        ? writeStorage(key, value(localState))
        : writeStorage(key, value),
    [key]
  )

  const deleteState = useCallback(() => deleteFromStorage(key), [key])

  return {
    data: localState ?? defaultValue,
    onSetItem: writeState,
    onRemoveItem: deleteState,
  }
}

export default useLocalStorage

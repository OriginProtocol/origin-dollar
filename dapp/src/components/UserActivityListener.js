import React, { Component } from 'react'
import { useStoreState } from 'pullstate'

import AccountStore from 'stores/AccountStore'
/* Intentionally not using withIsMobile since that one is more interested in screen sizes. Here it is important
 * for us to detect a touch device (since those ones do not have mouses)
 */
import { isMobileDevice } from 'utils/device'

const activeDelay = 10000 // time in miliseconds after last activity and we consider user still active

/* Listens for user activity and triggers the state from 'active' to 'idle' accordingly.
 * ⚠️ Doesn't work on mobile ⚠️ - defaults to always 'active' on mobile
 */
class UserActivityListener extends React.Component {
  constructor(props) {
    super(props)
    this.state = {
      lastActivityTime: Date.now(),
      userActivityState: 'active',
      stateCheckInterval: null,
    }

    this.onMouseMove = this.onMouseMove.bind(this)
    this.onStateCheck = this.onStateCheck.bind(this)
  }

  onMouseMove() {
    this.setState({ lastActivityTime: Date.now() })
  }

  onStateCheck() {
    if (
      this.state.userActivityState === 'active' &&
      Date.now() - this.state.lastActivityTime > activeDelay
    ) {
      AccountStore.update((s) => {
        s.active = 'idle'
      })
      this.setState({ userActivityState: 'idle' })
    } else if (
      this.state.userActivityState === 'idle' &&
      Date.now() - this.state.lastActivityTime < activeDelay
    ) {
      AccountStore.update((s) => {
        s.active = 'active'
      })
      this.setState({ userActivityState: 'active' })
    }
  }

  componentDidMount() {
    /* These functions are not called on mobile for now, so the user state is permanently set to
     * `active`. If for some reson this prooves not to be a good enough solution we will need to
     * implement more inteligent mobile activity checks. (probably listen to scrool events and
     * button interaction events )
     */
    if (!isMobileDevice()) {
      document.addEventListener('mousemove', this.onMouseMove)
      // check for user activity and adjust states when needed
      this.setState({
        stateCheckInterval: setInterval(this.onStateCheck, 500),
      })
    }
  }

  componentWillUnmount() {
    if (this.state.stateCheckInterval) {
      clearInterval(this.state.stateCheckInterval)
    }

    document.removeEventListener('mousemove', this.onMouseMove)
  }

  render() {
    return ''
  }
}

export default UserActivityListener

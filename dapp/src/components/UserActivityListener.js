import React, { Component } from 'react'
import { useStoreState } from 'pullstate'

import AccountStore from 'stores/AccountStore'

const activeDelay = 10000 // time in miliseconds after last activity and we consider user still active

class UserActivityListener extends React.Component {
  constructor(props) {
    super(props)
    this.state = {
      lastActivityTime: Date.now(),
      userActivityState: 'active',
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
    document.addEventListener('mousemove', this.onMouseMove)
    // check for user activity and adjust states when needed
    setInterval(this.onStateCheck, 500)
  }

  render() {
    return ''
  }
}

export default UserActivityListener

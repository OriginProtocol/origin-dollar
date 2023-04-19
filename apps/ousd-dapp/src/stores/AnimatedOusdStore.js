import { Store } from 'pullstate'
/*
 * Needs to be a separate store because pullstate has some problems with race conditions when updating
 * the store state multiple times per frame. Which happens fast since updating the animated values
 * collide with other Store updates when it was part of the AccountStore.
 */
const AnimatedOusdStore = new Store({
  animatedOusdBalance: null,
})

export default AnimatedOusdStore

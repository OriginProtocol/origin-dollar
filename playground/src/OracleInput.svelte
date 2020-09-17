<script>
  import { setOracle } from "./stores.js";
  export let coin;
  export let type;

  let price = "";
  let updating = false;

  async function onChange() {
    price = parseFloat(price).toFixed(4);
    updating = true;
    await setOracle(coin, type, price)
    updating = false;
  }
</script>

<style>
  input {
    width: 43px;
    background: #ccc;
    border: solid 1px;
    border-radius: 2px;
    padding-left: 4px;
  }
</style>

<input
  class={updating ? 'updating' : ''}
  bind:value={price}
  on:change={onChange} />

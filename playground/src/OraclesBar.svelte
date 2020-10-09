<script>
  import OracleInputs from "./OracleInputs.svelte";
  import { revertToSnapshot } from "./stores.js";
</script>

<style>
  .bar {
    position: absolute;
    top: 10px;
    right: 20px;
    text-align: right;
  }
</style>

<div class="bar">
  <button on:click={()=>revertToSnapshot()}>Reset</button>
  <OracleInputs coin="DAI" />
  <OracleInputs coin="USDC" />
  <OracleInputs coin="USDT" />
</div>

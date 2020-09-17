<script>
  import OracleInputs from "./OracleInputs.svelte";
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
  <OracleInputs coin="DAI" />
  <OracleInputs coin="USDC" />
  <OracleInputs coin="USDT" />
</div>

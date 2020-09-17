<script>
  import OracleInput from "./OracleInput.svelte";

  export let coin;
</script>

<style>
  .v {
    float: left;
    padding-left: 20px;
  }
</style>

<div class="v">
  {coin}:
  <OracleInput {coin} type="open" />
  <OracleInput {coin} type="chainlink" />
</div>

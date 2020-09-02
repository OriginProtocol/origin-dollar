<script>
  export let tx;
</script>

<style>
  .fade {
    color: rgb(51, 51, 51);
  }
</style>

<tr on:click={() => console.log(tx)}>
  <td class="fade">⁍</td>
  <td class="fade">{tx.blockNumber}</td>
  <td>{tx.userName}</td>
  <td style="text-align:right">{tx.contractName}</td>
  <td>{tx.methodName}</td>
  <td style="text-align:right">
    {tx.reciept.gasUsed.toNumber().toLocaleString()}
  </td>
</tr>

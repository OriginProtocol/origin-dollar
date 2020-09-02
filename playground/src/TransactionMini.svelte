<script>
  export let tx;
</script>

<tr on:click={() => console.log(tx)}>
  <td>⁍</td>
  <td>{tx.blockNumber}</td>
  <td>{tx.userName}</td>
  <td>{tx.contractName}</td>
  <td>{tx.methodName}</td>
  <td style="text-align:right">
    {tx.reciept.gasUsed.toNumber().toLocaleString()}
  </td>
</tr>

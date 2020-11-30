<script>
  import { tweened } from "svelte/motion";
  import { cubicOut } from "svelte/easing";
  import { onDestroy } from "svelte";
  export let token;
  export let holding;
  let isChanging = false;
  let previousValue = 0;
  let hasBeenSet = false;
  const progress = tweened(0, {
    duration: 400,
    easing: cubicOut,
  });
  const unsubscribe = holding.subscribe((v) => {
    isChanging = v <= previousValue ? "-" : "+";
    let duration = 100 + Math.pow(100 + Math.abs(v - previousValue), 0.5) * 15;
    duration = Math.min(duration, 2000);
    if (hasBeenSet == false && v > 0) {
      duration = 0;
      hasBeenSet = true;
    }
    progress.set(parseFloat(v), { duration: duration }).then(() => {
      isChanging = false;
    });
    previousValue = v;
  });
  onDestroy(unsubscribe);
</script>

<style>
  .fade {
    opacity: 0.1;
    display:none;
  }
  .changing-plus {
    color: #a9fa63;
  }
  .changing-minus {
    color: #F87F59;
  }
</style>

<tr
  class="{$progress == 0 || $progress == undefined || isNaN($progress) ? 'fade' : ''}
  {isChanging == '+' ? 'changing-plus' : ''}
  {isChanging == '-' ? 'changing-minus' : ''}">
  <td>💰</td>
  <td style="text-align:right">
    {$progress ? $progress.toLocaleString(undefined, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }) : '0'}
  </td>
  <td>{token.toLowerCase()}</td>
</tr>

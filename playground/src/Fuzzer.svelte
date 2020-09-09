<script>
  const names = ["Anna", "Matt", "Sofi", "Attacker"];
  const coins = ["USDT", "USDC", "DAI"];
  let hasMinted = {};
  import { blockRun, updateAllHoldings } from "./stores.js";
  let isPlaying = false;

  async function nextAction() {
    const name = names[Math.floor(Math.random() * names.length)];
    const amount = (Math.random() * 1000).toFixed(4);
    const coin = coins[Math.floor(Math.random() * coins.length)];

    console.log("ℷ", name, amount, coin);

    if (Math.random() < 0.7 || !hasMinted[name]) {
      await _mint(name, amount * 2, coin);
      hasMinted[name] = true;
    } else {
      await _redeem(name, amount, coin);
    }
    await updateAllHoldings();

    if (isPlaying) {
      setTimeout(() => {
        nextAction();
      }, 50);
    }
  }

  async function _mint(name, amount, coin) {
    await blockRun([name, coin, "mint", amount + coin]);
    await blockRun([name, coin, "approve", "Vault", amount + coin]);
    await blockRun([name, "Vault", "mint", coin, amount + coin]);
  }

  async function _redeem(name, amount, coin) {
    await blockRun([name, "Vault", "redeem", amount + "OUSD"]);
  }

  function play() {
    isPlaying = true;
    nextAction();
  }

  function stop() {
    isPlaying = false;
  }
</script>

<div>
  <h3>Deposit Fuzzer</h3>
  <p>
    {#if isPlaying}
      <button class="btn" on:click={stop}>Stop</button>
    {:else}<button class="btn" on:click={play}>Play</button>{/if}
  </p>
</div>

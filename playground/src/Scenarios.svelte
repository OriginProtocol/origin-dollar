<script>
  import { scenarios, blockRun, updateAllHoldings } from "./stores.js";
  const selectedSecenario = scenarios[0];
  const lines = selectedSecenario.actions
    .split("\n")
    .filter((x) => x.trim() != "");
  let activeLineIndex = -1;

  async function play() {
    console.log("OKKAA");
    try {
      for (const i in lines) {
        const line = lines[i];
        if (line.trim() == "") {
          continue;
        }
        if (line.trim().startsWith("#")) {
          continue;
        }
        activeLineIndex = i;
        console.log("👾", line);
        await blockRun(line.trim().split(" "));
        await updateAllHoldings();
      }
    } catch (e) {
      console.error(e);
    }
    activeLineIndex = -1;
  }
</script>

<style>
  li.comment {
    list-style-type: none;
    margin-left: -20px;
    padding-left: 0px;
  }
  li.code {
    list-style-type: none;
    font-family: Ioseveka, monospace;
    opacity: 0.5;
  }
  li.active {
    color: white;
    opacity: 1;
  }
</style>

<div class="card" style="float:left; width:462px; height: auto;">
  <h3>
    {selectedSecenario.name}
    <button on:click={play}>Play</button>
  </h3>
  <ul>
    {#each lines as line, i}
      {#if line.trim().startsWith('#')}
        <li class="comment {i == activeLineIndex ? 'active' : ''}">
          <span style="color: #333">#</span>
          {line.trim().replace(/^# /, '')}
        </li>
      {:else}
        <li class="code {i == activeLineIndex ? 'active' : ''}">
          {line.trim()}
        </li>
      {/if}
    {/each}
  </ul>
</div>

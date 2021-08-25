/**
 * Allows you to trace the execution of solidity call.
 */

const hre = require("hardhat");

let tracingEnabled = false;

async function withTracing(fn) {
  tracingEnabled = true;
  traceOn();
  await fn();
  tracingEnabled = false;
}

function traceOn() {
  const node = hre.network.provider["_node"];
  const vmTracer = node["_vmTracer"];
  vmTracer.disableTracing();
  let stackDepth = 0;

  // Before message handler
  const prevBeforeMessageHandler = vmTracer["_beforeMessageHandler"];
  vmTracer["_beforeMessageHandler"] = async (message, next) => {
    if (!tracingEnabled) {
      next();
      return;
    }
    const sig = bufferToHex(message.data.slice(0, 4));
    if (sig == "00000000") {
      console.log("EVENT?: ", bufferToHex(message.data.slice(4)));
    } else {
      console.log(
        "🡒    ".repeat(stackDepth),
        "🔹",
        sig,
        bufferToHex(message.data.slice(4)),
        "→",
        bufferToHex(message.to)
      );
    }
    stackDepth += 1;
    if (prevBeforeMessageHandler) {
      prevBeforeMessageHandler(message, next);
    } else {
      next();
    }
  };
  // After message handler
  const prevAfterMessageHandler = vmTracer["_afterMessageHandler"];
  vmTracer["_afterMessageHandler"] = async (message, next) => {
    if (!tracingEnabled) {
      next();
      return;
    }
    stackDepth -= 1;
    console.log(
      "🡒    ".repeat(stackDepth),
      "⬅️",
      bufferToHex(message.execResult.returnValue)
    );
    // console.log("🏓", message);

    if (prevAfterMessageHandler) {
      prevAfterMessageHandler(message, next);
    } else {
      next();
    }
  };
  // Step handler
  // const getStack = (step, i) => {
  // if (step.stack.length <= i) {
  //    return "-";
  //  }
  //  return step.stack[step.stack.length - i - 1].toString(16);
  // };
  // vmTracer["_stepHandler"] = async (step, next) => {
  //   console.log("🏎", step.pc, step.opcode, getStack(step,0), getStack(step, 1), step.stack.length);
  //   next();
  // };
  vmTracer.enableTracing();
}

function bufferToHex(buffer) {
  return [...new Uint8Array(buffer)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

module.exports = {
  withTracing,
};

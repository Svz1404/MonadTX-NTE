import "dotenv/config";
import { ethers } from "ethers";
import ora from "ora";
import readline from "readline";
import cfonts from "cfonts";

const RPC_URL = "https://testnet-rpc.monad.xyz";
const PRIVATE_KEY = process.env.PRIVATE_KEY;
const ROUTER_ADDRESS = "0x760AfE86e5de5fa0Ee542fc7B7B713e1c5425701";

const ROUTER_ABI = ["function deposit() payable"];

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function askQuestion(query) {
  return new Promise((resolve) => rl.question(query, resolve));
}

async function wrapMON(index, total) {
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
  const router = new ethers.Contract(ROUTER_ADDRESS, ROUTER_ABI, wallet);
  const amount = ethers.parseEther("0.0001");

  const spinner = ora(`(${index}/${total}) Wrapping ${ethers.formatEther(amount)} MON to WMON...`).start();

  try {
    const tx = await router.deposit({
      value: amount,
      gasLimit: 29498,
      gasPrice: ethers.parseUnits("52.5", "gwei"),
    });

    spinner.text = `(${index}/${total}) Transaction sent! Waiting for confirmation...\nHash: ${tx.hash}`;
    await tx.wait();

    spinner.succeed(`(${index}/${total}) Transaction confirmed!`);
  } catch (error) {
    spinner.fail(`(${index}/${total}) Error: ${error.message}`);
  }
}

async function main() {
    cfonts.say("NT Exhaust", {
        font: "block",
        align: "center",
        colors: ["cyan", "magenta"],
        background: "black",
        letterSpacing: 1,
        lineHeight: 1,
        space: true,
        maxLength: "0",
      });
    
      console.log("=== Telegram Channel🚀 : NT Exhaust (@NTExhaust) ===", "\x1b[36m");
  const loopCount = await askQuestion("How many times should the script run before pausing? ");
  const waitTime = await askQuestion("How long should the script wait before restarting? (Enter time in minutes) ");
  rl.close();

  const waitMilliseconds = parseInt(waitTime) * 60 * 1000;

  while (true) {
    console.log(`\n🚀 Starting batch of ${loopCount} transactions...\n`);

    for (let i = 1; i <= parseInt(loopCount); i++) {
      await wrapMON(i, loopCount);
    }

    console.log(`\n⏳ Waiting ${waitTime} minutes before starting the next batch...\n`);
    await new Promise((resolve) => setTimeout(resolve, waitMilliseconds));
  }
}

main();

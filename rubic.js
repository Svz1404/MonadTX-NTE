import "dotenv/config";
import { ethers } from "ethers";
import ora from "ora";
import readline from "readline";
import cfonts from "cfonts";
import axios from "axios";

const RPC_URL = "https://testnet-rpc.monad.xyz";
const PRIVATE_KEY = process.env.PRIVATE_KEY;
const ROUTER_ADDRESS = "0x760AfE86e5de5fa0Ee542fc7B7B713e1c5425701";
const RUBIC_API_URL = "https://testnet-api.rubic.exchange/api/v2/trades/onchain/new_extended";
const RUBIC_REWARD_URL = "https://testnet-api.rubic.exchange/api/v2/rewards/tmp_onchain_reward_amount_for_user?address=";

const ROUTER_ABI = ["function deposit() payable"];

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function askQuestion(query) {
  return new Promise((resolve) => rl.question(query, resolve));
}

async function endInitialRubicRequest(txHash, walletAddress) {
  try {
    const payload = {
      "price_impact": null,
      "walletName": "metamask",
      "deviceType": "desktop",
      "slippage": 0,
      "expected_amount": "1000000000000000",
      "mevbot_protection": false,
      "to_amount_min": "1000000000000000",
      "network": "monad-testnet",
      "provider": "wrapped",
      "from_token": "0x0000000000000000000000000000000000000000",
      "to_token": ROUTER_ADDRESS,
      "from_amount": "1000000000000000",
      "to_amount": "1000000000000000",
      "user": walletAddress,
      "hash": txHash
    };

    await axios.post(`${RUBIC_API_URL}?valid=false`, payload, {
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json, text/plain, */*",
        "Origin": "https://testnet.rubic.exchange",
        "Referer": "https://testnet.rubic.exchange/",
        "Cookie": process.env.RUBIC_COOKIE,
      },
    });

    console.log(`✅ Initial Rubic API request completed for transaction ${txHash}`);
  } catch (error) {
    console.error(`❌ Error in initial Rubic API request: ${error.message}`);
  }
}

async function sendRubicRequest(txHash, walletAddress) {
  try {
    const payload = {
      success: true,
      hash: txHash,
      user: walletAddress,
    };

    await axios.patch(RUBIC_API_URL, payload, {
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json, text/plain, */*",
        "Origin": "https://testnet.rubic.exchange",
        "Referer": "https://testnet.rubic.exchange/",
        "Cookie": process.env.RUBIC_COOKIE,
      },
    });

    console.log(`✅ Successfully notified Rubic API for transaction ${txHash}`);
  } catch (error) {
    console.error(`❌ Error notifying Rubic API: ${error.message}`);
  }
}

async function checkRubicRewards(walletAddress) {
  try {
    const response = await axios.get(`${RUBIC_REWARD_URL}${walletAddress}`, {
      headers: {
        "Accept": "application/json, text/plain, */*",
        "Origin": "https://testnet.rubic.exchange",
        "Referer": "https://testnet.rubic.exchange/",
        "Cookie": process.env.RUBIC_COOKIE,
      },
    });
    
    console.log(`✅ Rubic rewards response:`, response.data);
  } catch (error) {
    console.error(`❌ Error fetching Rubic rewards: ${error.message}`);
  }
}

function getRandomAmountInEther(min, max) {
  const randomValue = Math.random() * (max - min) + min;
  return ethers.parseEther(randomValue.toFixed(6).toString());
}

async function wrapMON(index, total, wallet) {
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const router = new ethers.Contract(ROUTER_ADDRESS, ROUTER_ABI, wallet);

  const amount = getRandomAmountInEther(0.001, 0.005); // Random amount between 0.001 and 0.005 Ether

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

    await endInitialRubicRequest(tx.hash, wallet.address);

    await sendRubicRequest(tx.hash, wallet.address);

    await checkRubicRewards(wallet.address);
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

  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const wallet = new ethers.Wallet(PRIVATE_KEY, provider);

  const loopCount = await askQuestion("How many times should the script run before pausing? ");
  const waitTime = await askQuestion("How long should the script wait before restarting? (Enter time in minutes) ");
  rl.close();

  const waitMilliseconds = parseInt(waitTime) * 60 * 1000;

  while (true) {
    console.log(`\n🚀 Starting batch of ${loopCount} transactions...\n`);

    for (let i = 1; i <= parseInt(loopCount); i++) {
      try{
      await wrapMON(i, loopCount, wallet);
      }catch{}
    }

    console.log(`\n⏳ Waiting ${waitTime} minutes before starting the next batch...\n`);
    await new Promise((resolve) => setTimeout(resolve, waitMilliseconds));
  }
}

main();

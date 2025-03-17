import "dotenv/config";
import blessed from "blessed";
import figlet from "figlet";
import { ethers } from "ethers";
import axios from "axios";

const RPC_URL = process.env.RPC_URL || "https://testnet-rpc.monad.xyz";
const PRIVATE_KEY = process.env.PRIVATE_KEY || "";
const WMON_ADDRESS = process.env.WMON_ADDRESS || "0x760AfE86e5de5fa0Ee542fc7B7B713e1c5425701";
const ROUTER_ADDRESS = process.env.ROUTER_ADDRESS || WMON_ADDRESS;
const RUBIC_API_URL = process.env.RUBIC_API_URL || "https://testnet-api.rubic.exchange/api/v2/trades/onchain/new_extended";
const RUBIC_COOKIE = process.env.RUBIC_COOKIE || "";
const RUBIC_REWARD_URL = "https://testnet-api.rubic.exchange/api/v2/rewards/tmp_onchain_reward_amount_for_user?address=";
const HEDGEMONY_BEARER = process.env.HEDGEMONY_BEARER;
const USDC_ADDRESS = "0xf817257fed379853cDe0fa4F97AB987181B1E5Ea";
const WETH_ADDRESS = "0xB5a30b0FDc5EA94A52fDc42e3E9760Cb8449Fb37";
const TAYA_SWAP_CONTRACT = "0x4ba4bE2FB69E2aa059A551Ce5d609Ef5818Dd72F";
const TOKENS = [USDC_ADDRESS, WETH_ADDRESS];
const HEDGEMONY_SWAP_CONTRACT = "0xfB06ac672944099E33Ad7F27f0Aa9B1bc43e65F8";
const HEDGE_ADDRESS = process.env.HEDGE_ADDRESS || "0x04a9d9D4AEa93F512A4c7b71993915004325ed38";
const MON_TO_HEDGE_CONVERSION_FACTOR = ethers.parseUnits("15.40493695", 18);
const HEDGE_TO_MON_CONVERSION_FACTOR = ethers.parseUnits("0.06493", 18);
const WEI_PER_ETHER = ethers.parseUnits("1", 18);
const MAX_RPC_RETRIES = 5;
const RETRY_DELAY_MS = 5000;


const ERC20_ABI = ["function balanceOf(address owner) view returns (uint256)"];
const ROUTER_ABI = ["function deposit() payable", "function withdraw(uint256 amount)"];
const ERC20_ABI_APPROVE = [
  "function balanceOf(address owner) view returns (uint256)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)"
];
const TAYA_SWAP_ABI = [
  "function WETH() view returns (address)",
  "function swapExactETHForTokens(uint256 amountOutMin, address[] path, address to, uint256 deadline) payable",
  "function swapExactTokensForTokens(uint256 amountIn, uint256 amountOutMin, address[] path, address to, uint256 deadline) nonpayable"
];

let walletInfo = {
  address: "",
  balanceMON: "0.00",
  balanceWMON: "0.00",
  balanceHEDGE: "0.00",
  balanceWETH: "0.00",
balanceHEDGE: "0.00",
  balanceUSDC: "0.00",
  network: "Monad Testnet",
  status: "Initializing"
};
let transactionLogs = [];
let autoSwapRunning = false;
let autoSwapCancelled = false;
let tayaSwapRunning = false;
let tayaSwapCancelled = false;
let hedgemonySwapRunning = false;
let hedgemonySwapCancelled = false;
let globalWallet = null;
let transactionQueue = Promise.resolve();
let transactionQueueList = [];
let transactionIdCounter = 0;
let nextNonce = null;

process.on("unhandledRejection", (reason, promise) => {
  addLog(`Unhandled Rejection: ${reason}`, "system");
});

process.on("uncaughtException", (error) => {
  addLog(`Uncaught Exception: ${error.message}`, "system");
});

function getShortAddress(address) {
  return address.slice(0, 6) + "..." + address.slice(-4);
}
function getShortHash(hash) {
  return hash.slice(0, 6) + "..." + hash.slice(-4);
}
function getTokenSymbol(address) {
  if (address.toLowerCase() === WMON_ADDRESS.toLowerCase()) return "WMON";
  if (address.toLowerCase() === USDC_ADDRESS.toLowerCase()) return "USDC";
  if (address.toLowerCase() === WETH_ADDRESS.toLowerCase()) return "WETH";
  return address;
}
// Atur Delay antar transaksi
function getRandomDelay() {
  return Math.random() * (60000 - 30000) + 30000;
}
function getRandomAmount() {
  const min = 0.005, max = 0.01;
  const randomVal = Math.random() * (max - min) + min;
  return ethers.parseEther(randomVal.toFixed(6));
}
function getRandomAmountTaya() {
  const min = 0.005, max = 0.01;
  const randomVal = Math.random() * (max - min) + min;
  return ethers.parseEther(randomVal.toFixed(6));
}
function getRandomAmountHedgemony() {
  const min = 0.003, max = 0.01;
  const randomVal = Math.random() * (max - min) + min;
  return ethers.parseEther(randomVal.toFixed(6));
}

// Rahndom ammount $MON (Hedgemony)
function getRandomAmountMonToHedge() {
  const min = 0.005, max = 0.01;
  const randomVal = Math.random() * (max - min) + min;
  return ethers.parseUnits(randomVal.toFixed(6), 18);
}

// Random ammount $HEDGE (Hedgemony)
function getRandomAmountHedgeToMon() {
  const min = 20, max = 50;
  const randomInt = Math.floor(Math.random() * (max - min + 1)) + min;
  return ethers.parseUnits(randomInt.toString(), 18);
}

function addLog(message, type) {
  const timestamp = new Date().toLocaleTimeString();
  let coloredMessage = message;
  if (type === "rubic") {
    coloredMessage = `{bright-cyan-fg}${message}{/bright-cyan-fg}`;
  } else if (type === "taya") {
    coloredMessage = `{bright-yellow-fg}${message}{/bright-yellow-fg}`;
  } else if (type === "hedgemony") {
    coloredMessage = `{bright-magenta-fg}${message}{/bright-magenta-fg}`;
  }
  transactionLogs.push(`${timestamp}  ${coloredMessage}`);
  updateLogs();
}
function updateLogs() {
  logsBox.setContent(transactionLogs.join("\n"));
  logsBox.setScrollPerc(100);
  safeRender();
}
function clearTransactionLogs() {
  transactionLogs = [];
  updateLogs();
  addLog("Transaction logs telah dihapus.", "system");
}

const screen = blessed.screen({
  smartCSR: true,
  title: "NT Exhaust",
  fullUnicode: true,
  mouse: true
});
let renderTimeout;
function safeRender() {
  if (renderTimeout) clearTimeout(renderTimeout);
  renderTimeout = setTimeout(() => { screen.render(); }, 50);
}
const headerBox = blessed.box({
  top: 0,
  left: "center",
  width: "100%",
  tags: true,
  style: { fg: "white", bg: "default" }
});
figlet.text("MONAD AUTO SWAP".toUpperCase(), { font: "Standard", horizontalLayout: "default" }, (err, data) => {
  if (err) headerBox.setContent("{center}{bold}MONAD AUTO SWAP{/bold}{/center}");
  else headerBox.setContent(`{center}{bold}{green-fg}${data}{/green-fg}{/bold}{/center}`);
  safeRender();
});
const descriptionBox = blessed.box({
  left: "center",
  width: "100%",
  content: "{center}{bold}{bright-cyan-fg}=== Telegram Channel 🚀 : NT Exhaust (@NTExhaust) ==={/bright-cyan-fg}{/bold}{/center}",
  tags: true,
  style: { fg: "white", bg: "black" }
});
const logsBox = blessed.box({
  label: " Transaction Logs ",
  left: 0,
  border: { type: "line" },
  scrollable: true,
  alwaysScroll: true,
  mouse: true,
  keys: true,
  vi: true,
  tags: true,
  scrollbar: { ch: " ", inverse: true, style: { bg: "blue" } },
  content: "",
  style: { border: { fg: "bright-red" }, bg: "default" }
});
const walletBox = blessed.box({
  label: " Informasi Wallet ",
  left: "60%",
  border: { type: "line" },
  style: { border: { fg: "magenta" }, fg: "white", bg: "default", align: "left", valign: "top" },
  content: ""
});
function updateWallet() {
  const shortAddress = walletInfo.address ? getShortAddress(walletInfo.address) : "N/A";
  const content = ` Address: ${shortAddress}
 MON : ${walletInfo.balanceMON}
 WMON: ${walletInfo.balanceWMON}
 HEDGE: ${walletInfo.balanceHEDGE}
 WETH: ${walletInfo.balanceWETH}
 USDC: ${walletInfo.balanceUSDC}
 Network: ${walletInfo.network}`;
  walletBox.setContent(content);
  safeRender();
}

function stopAllTransactions() {
  if (autoSwapRunning || tayaSwapRunning || hedgemonySwapRunning) {
    autoSwapCancelled = true;
    tayaSwapCancelled = true;
    hedgemonySwapCancelled = true;
    addLog("Stop All Transactions command received. Semua transaksi telah dihentikan.", "system");
  }
}

function getRubicMenuItems() {
  return autoSwapRunning
    ? ["Auto Swap Mon & WMON", "Stop Transaction", "Clear Transaction Logs", "Back To Main Menu", "Exit"]
    : ["Auto Swap Mon & WMON", "Clear Transaction Logs", "Back To Main Menu", "Exit"];
}
function getTayaMenuItems() {
  return tayaSwapRunning
    ? ["Auto Swap Random Token", "Auto Swap MON & WMON", "Stop Transaction", "Clear Transaction Logs", "Back To Main Menu", "Exit"]
    : ["Auto Swap Random Token", "Auto Swap MON & WMON", "Clear Transaction Logs", "Back To Main Menu", "Exit"];
}
function getHedgemonyMenuItems() {
  return hedgemonySwapRunning
    ? ["Auto Swap Mon & WMON", "Auto Swap Mon & HEDGE", "Stop Transaction", "Clear Transaction Logs", "Back To Main Menu", "Exit"]
    : ["Auto Swap Mon & WMON", "Auto Swap Mon & HEDGE", "Clear Transaction Logs", "Back To Main Menu", "Exit"];
}

function getMainMenuItems() {
  let items = ["Rubic Swap", "Taya Swap", "Hedgemony Swap", "Antrian Transaksi", "Clear Transaction Logs", "Refresh", "Exit"];
  if (autoSwapRunning || tayaSwapRunning || hedgemonySwapRunning) {
    items.unshift("Stop All Transactions");
  }
  return items;
}

const mainMenu = blessed.list({
  label: " Menu ",
  left: "60%",
  keys: true,
  vi: true,
  mouse: true,
  border: { type: "line" },
  style: { fg: "white", bg: "default", border: { fg: "yellow" }, selected: { bg: "green", fg: "black" } },
  items: getMainMenuItems()
});
const rubicSubMenu = blessed.list({
  label: " Rubic Swap Menu ",
  left: "60%",
  keys: true,
  vi: true,
  mouse: true,
  border: { type: "line" },
  style: { fg: "white", bg: "default", border: { fg: "yellow" }, selected: { bg: "cyan", fg: "black" } },
  items: getRubicMenuItems()
});
rubicSubMenu.hide();
const tayaSubMenu = blessed.list({
  label: " Taya Swap Menu ",
  left: "60%",
  keys: true,
  vi: true,
  mouse: true,
  border: { type: "line" },
  style: { fg: "white", bg: "default", border: { fg: "yellow" }, selected: { bg: "yellow", fg: "black" } },
  items: getTayaMenuItems()
});
tayaSubMenu.hide();
const hedgemonySubMenu = blessed.list({
  label: " Hedgemony Swap Menu ",
  left: "60%",
  keys: true,
  vi: true,
  mouse: true,
  border: { type: "line" },
  style: { fg: "white", bg: "black", border: { fg: "yellow" }, selected: { bg: "magenta", fg: "black" } },
  items: getHedgemonyMenuItems()
});
hedgemonySubMenu.hide();
const promptBox = blessed.prompt({
  parent: screen,
  border: "line",
  height: 5,
  width: "60%",
  top: "center",
  left: "center",
  label: "{bright-blue-fg}Swap Prompt{/bright-blue-fg}",
  tags: true,
  keys: true,
  vi: true,
  mouse: true,
  style: { fg: "bright-white", bg: "black", border: { fg: "red" } }
});

screen.append(headerBox);
screen.append(descriptionBox);
screen.append(logsBox);
screen.append(walletBox);
screen.append(mainMenu);
screen.append(rubicSubMenu);
screen.append(tayaSubMenu);
screen.append(hedgemonySubMenu);

function adjustLayout() {
  const screenHeight = screen.height;
  const screenWidth = screen.width;
  const headerHeight = Math.max(8, Math.floor(screenHeight * 0.15));
  headerBox.top = 0;
  headerBox.height = headerHeight;
  headerBox.width = "100%";
  descriptionBox.top = "25%";
  descriptionBox.height = Math.floor(screenHeight * 0.05);
  logsBox.top = headerHeight + descriptionBox.height;
  logsBox.left = 0;
  logsBox.width = Math.floor(screenWidth * 0.6);
  logsBox.height = screenHeight - (headerHeight + descriptionBox.height);
  walletBox.top = headerHeight + descriptionBox.height;
  walletBox.left = Math.floor(screenWidth * 0.6);
  walletBox.width = Math.floor(screenWidth * 0.4);
  walletBox.height = Math.floor(screenHeight * 0.35);
  mainMenu.top = headerHeight + descriptionBox.height + walletBox.height;
  mainMenu.left = Math.floor(screenWidth * 0.6);
  mainMenu.width = Math.floor(screenWidth * 0.4);
  mainMenu.height = screenHeight - (headerHeight + descriptionBox.height + walletBox.height);
  rubicSubMenu.top = mainMenu.top;
  rubicSubMenu.left = mainMenu.left;
  rubicSubMenu.width = mainMenu.width;
  rubicSubMenu.height = mainMenu.height;
  tayaSubMenu.top = mainMenu.top;
  tayaSubMenu.left = mainMenu.left;
  tayaSubMenu.width = mainMenu.width;
  tayaSubMenu.height = mainMenu.height;
  hedgemonySubMenu.top = mainMenu.top;
  hedgemonySubMenu.left = mainMenu.left;
  hedgemonySubMenu.width = mainMenu.width;
  hedgemonySubMenu.height = mainMenu.height;
  safeRender();
}
screen.on("resize", adjustLayout);
adjustLayout();
screen.key(["escape", "q", "C-c"], () => process.exit(0));
screen.key(["C-up"], () => { logsBox.scroll(-1); safeRender(); });
screen.key(["C-down"], () => { logsBox.scroll(1); safeRender(); });
safeRender();
mainMenu.focus();
updateLogs();
updateWalletData();

function addTransactionToQueue(transactionFunction, description = "Transaksi") {
  const transactionId = ++transactionIdCounter;
  transactionQueueList.push({
    id: transactionId,
    description,
    timestamp: new Date().toLocaleTimeString(),
    status: "queued"
  });
  addLog(`Transaksi [${transactionId}] ditambahkan ke antrean: ${description}`, "system");
  updateQueueDisplay();

  transactionQueue = transactionQueue.then(async () => {
    updateTransactionStatus(transactionId, "processing");
    addLog(`Transaksi [${transactionId}] mulai diproses.`, "system");
    try {
      if (nextNonce === null) {
        const provider = new ethers.JsonRpcProvider(RPC_URL);
        nextNonce = await provider.getTransactionCount(globalWallet.address, "pending");
        addLog(`Nonce awal: ${nextNonce}`, "system");
      }
      const result = await transactionFunction(nextNonce);
      nextNonce++;
      updateTransactionStatus(transactionId, "completed");
      addLog(`Transaksi [${transactionId}] selesai.`, "system");
      return result;
    } catch (error) {
      updateTransactionStatus(transactionId, "error");
      addLog(`Transaksi [${transactionId}] gagal: ${error.message}`, "system");
      if (error.message && error.message.toLowerCase().includes("nonce has already been used")) {
        nextNonce++;
        addLog(`Nonce diincrement karena sudah digunakan. Nilai nonce baru: ${nextNonce}`, "system");
      } else if (error.message && error.message.toLowerCase().includes("rpc")) {
        let retries = 0;
        while (retries < MAX_RPC_RETRIES) {
          try {
            const provider = new ethers.JsonRpcProvider(RPC_URL);
            nextNonce = await provider.getTransactionCount(globalWallet.address, "pending");
            addLog(`RPC normal, nonce direfresh: ${nextNonce}`, "system");
            break;
          } catch (rpcError) {
            retries++;
            addLog(`RPC error, percobaan retry ${retries}: ${rpcError.message}`, "system");
            await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
          }
        }
        if (retries === MAX_RPC_RETRIES) {
          addLog(`RPC tetap error setelah ${MAX_RPC_RETRIES} percobaan. Transaksi dilewati.`, "system");
        }
      } else {
        try {
          const provider = new ethers.JsonRpcProvider(RPC_URL);
          nextNonce = await provider.getTransactionCount(globalWallet.address, "pending");
          addLog(`Nonce direfresh: ${nextNonce}`, "system");
        } catch (rpcError) {
          addLog(`Gagal refresh nonce: ${rpcError.message}`, "system");
        }
      }
      return;
    } finally {
      removeTransactionFromQueue(transactionId);
      updateQueueDisplay();
    }
  });
  return transactionQueue;
}


function updateTransactionStatus(id, status) {
  transactionQueueList.forEach(tx => {
    if (tx.id === id) tx.status = status;
  });
  updateQueueDisplay();
}
function removeTransactionFromQueue(id) {
  transactionQueueList = transactionQueueList.filter(tx => tx.id !== id);
  updateQueueDisplay();
}
function getTransactionQueueContent() {
  if (transactionQueueList.length === 0) return "Tidak ada transaksi dalam antrean.";
  return transactionQueueList.map(tx => `ID: ${tx.id} | ${tx.description} | ${tx.status} | ${tx.timestamp}`).join("\n");
}
let queueMenuBox = null;
let queueUpdateInterval = null;
function showTransactionQueueMenu() {
  const container = blessed.box({
    label: " Antrian Transaksi ",
    top: "10%",
    left: "center",
    width: "80%",
    height: "80%",
    border: { type: "line" },
    style: { border: { fg: "blue" } },
    keys: true,
    mouse: true,
    interactive: true
  });
  const contentBox = blessed.box({
    top: 0,
    left: 0,
    width: "100%",
    height: "90%",
    content: getTransactionQueueContent(),
    scrollable: true,
    keys: true,
    mouse: true,
    alwaysScroll: true,
    scrollbar: { ch: " ", inverse: true, style: { bg: "blue" } }
  });
  const exitButton = blessed.button({
    content: " [Keluar] ",
    bottom: 0,
    left: "center",
    shrink: true,
    padding: { left: 1, right: 1 },
    style: { fg: "white", bg: "red", hover: { bg: "blue" } },
    mouse: true,
    keys: true,
    interactive: true
  });
  exitButton.on("press", () => {
    addLog("Keluar Dari Menu Antrian Transaksi.", "system");
    clearInterval(queueUpdateInterval);
    container.destroy();
    queueMenuBox = null;
    mainMenu.show();
    mainMenu.focus();
    screen.render();
  });
  container.key(["a", "s", "d"], () => {
    addLog("Keluar Dari Menu Antrian Transaksi.", "system");
    clearInterval(queueUpdateInterval);
    container.destroy();
    queueMenuBox = null;
    mainMenu.show();
    mainMenu.focus();
    screen.render();
  });
  container.append(contentBox);
  container.append(exitButton);
  queueUpdateInterval = setInterval(() => {
    contentBox.setContent(getTransactionQueueContent());
    screen.render();
  }, 1000);
  mainMenu.hide();
  screen.append(container);
  container.focus();
  screen.render();
}
function updateQueueDisplay() {
  if (queueMenuBox) {
    queueMenuBox.setContent(getTransactionQueueContent());
    screen.render();
  }
}

async function updateWalletData() {
  try {
    if (!RPC_URL || !PRIVATE_KEY)
      throw new Error("RPC_URL / PRIVATE_KEY tidak terdefinisi di .env");
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
    globalWallet = wallet;
    walletInfo.address = wallet.address;
    const [balanceMON, balanceWMON, balanceWETH, balanceUSDC, rawHedgeBalance] = await Promise.all([
      provider.getBalance(wallet.address),
      new ethers.Contract(WMON_ADDRESS, ERC20_ABI, provider).balanceOf(wallet.address),
      new ethers.Contract(WETH_ADDRESS, ERC20_ABI, provider).balanceOf(wallet.address),
      new ethers.Contract(USDC_ADDRESS, ERC20_ABI, provider).balanceOf(wallet.address),
      new ethers.Contract(HEDGE_ADDRESS, ERC20_ABI, provider).balanceOf(wallet.address)
    ]);
    walletInfo.balanceMON = ethers.formatEther(balanceMON);
    walletInfo.balanceWMON = ethers.formatEther(balanceWMON);
    walletInfo.balanceWETH = ethers.formatEther(balanceWETH);
    walletInfo.balanceUSDC = ethers.formatEther(balanceUSDC);
    walletInfo.balanceHEDGE = ethers.formatEther(rawHedgeBalance);
    updateWallet();
    addLog("Saldo & Wallet Updated !!", "system");
  } catch (error) {
    addLog("Gagal mengambil data wallet: " + error.message, "system");
  }
}

async function waitWithCancel(delay, type) {
  return Promise.race([
    new Promise(resolve => setTimeout(resolve, delay)),
    new Promise(resolve => {
      const interval = setInterval(() => {
        if (type === "rubic" && autoSwapCancelled) { clearInterval(interval); resolve(); }
        if (type === "taya" && tayaSwapCancelled) { clearInterval(interval); resolve(); }
        if (type === "hedgemony" && hedgemonySwapCancelled) { clearInterval(interval); resolve(); }
      }, 100);
    })
  ]);
}

async function executeSwap(index, total, wallet, swapToWMON, skipDelay = false) {
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const router = new ethers.Contract(ROUTER_ADDRESS, ROUTER_ABI, wallet);
  const amount = getRandomAmount();
  addLog(`Rubic: Memulai swap ${swapToWMON ? "MON ->> WMON" : "WMON ->> MON"} dengan jumlah ${ethers.formatEther(amount)}`, "rubic");
  try {
    const tx = swapToWMON
      ? await router.deposit({ value: amount })
      : await router.withdraw(amount);
    const txHash = tx.hash;
    addLog(`Rubic: Tx sent!! Tx Hash: ${getShortHash(txHash)}`, "rubic");
    await tx.wait();
    addLog(`Rubic: Tx confirmed!! Tx Hash: ${getShortHash(txHash)}`, "rubic");
    await sendRubicRequest(tx.hash, wallet.address, swapToWMON);
    await checkRubicRewards(wallet.address);
    addLog(`Rubic: Transaksi ${index}/${total} selesai.`, "rubic");
    await updateWalletData();
  } catch (error) {
    addLog(`Rubic: Error pada transaksi ${index}: ${error.message}`, "rubic");
  }
}
async function checkRubicRewards(walletAddress) {
  try {
    const response = await axios.get(`${RUBIC_REWARD_URL}${walletAddress}`, {
      headers: {
        "Accept": "application/json, text/plain, */*",
        "Origin": "https://testnet.rubic.exchange",
        "Referer": "https://testnet.rubic.exchange/",
        "Cookie": RUBIC_COOKIE,
      },
    });
    addLog(`Rubic: rewards ${JSON.stringify(response.data)}`, "rubic");
  } catch (error) {
    addLog(`Rubic: Error ${error.message}`, "rubic");
  }
}
async function sendRubicRequest(txHash, walletAddress, swapToWMON) {
  try {
    const payload = {
      success: true,
      hash: txHash,
      user: walletAddress,
      swapType: swapToWMON ? "MON_to_WMON" : "WMON_to_MON",
    };
    const response = await axios.patch(RUBIC_API_URL, payload, {
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json, text/plain, */*",
        "Origin": "https://testnet.rubic.exchange",
        Referer: "https://testnet.rubic.exchange/",
        Cookie: RUBIC_COOKIE,
      },
    });
    addLog(`Rubic: Swap ${swapToWMON ? "MON ke WMON" : "WMON ke MON"} selesai!! Tx Hash: ${getShortHash(txHash)}`, "rubic");
    addLog(`Rubic: Response API ${JSON.stringify(response.data)}`, "rubic");
  } catch (error) {
    addLog(`Rubic: Error notifying Rubic API: ${error.message}`, "rubic");
  }
}
async function runAutoSwap() {
  promptBox.setFront();
  promptBox.readInput("Masukkan jumlah swap Rubic:", "", async (err, value) => {
    promptBox.hide();
    screen.render();
    if (err || !value) {
      addLog("Rubic: Input tidak valid atau dibatalkan.", "rubic");
      return;
    }
    const loopCount = parseInt(value);
    if (isNaN(loopCount)) {
      addLog("Rubic: Input tidak valid. Harus berupa angka.", "rubic");
      return;
    }
    addLog(`Rubic: Anda memasukkan ${loopCount} kali auto swap Rubic.`, "rubic");
    if (autoSwapRunning) {
      addLog("Rubic: Transaksi sudah berjalan. Silahkan stop transaksi terlebih dahulu.", "rubic");
      return;
    }
    autoSwapRunning = true;
    autoSwapCancelled = false;
    mainMenu.setItems(getMainMenuItems());
    rubicSubMenu.setItems(getRubicMenuItems());
    rubicSubMenu.show();
    screen.render();
    let swapToWMON = true;
    for (let i = 1; i <= loopCount; i++) {
      if (autoSwapCancelled) {
        addLog(`Rubic: Auto swap dihentikan pada iterasi ${i}.`, "rubic");
        break;
      }
      await addTransactionToQueue(async (nonce) => {
        const provider = new ethers.JsonRpcProvider(RPC_URL);
        const router = new ethers.Contract(ROUTER_ADDRESS, ROUTER_ABI, globalWallet);
        const amount = getRandomAmount();
        addLog(`Rubic: Memulai swap ${swapToWMON ? "MON ->> WMON" : "WMON ->> MON"} dengan jumlah ${ethers.formatEther(amount)}`, "rubic");
        const tx = swapToWMON
          ? await router.deposit({ value: amount, nonce: nonce })
          : await router.withdraw(amount, { nonce: nonce });
        addLog(`Rubic: Tx sent!! Tx Hash: ${getShortHash(tx.hash)}`, "rubic");
        await tx.wait();
        addLog(`Rubic: Tx confirmed!! Tx Hash: ${getShortHash(tx.hash)}`, "rubic");
        await sendRubicRequest(tx.hash, globalWallet.address, swapToWMON);
        await updateWalletData();
      }, `Rubic Swap (${swapToWMON ? "MON->WMON" : "WMON->MON"}) - Iterasi ${i}`);
      swapToWMON = !swapToWMON;
      if (i < loopCount) {
        const delay = getRandomDelay();
        const minutes = Math.floor(delay / 60000);
        const seconds = Math.floor((delay % 60000) / 1000);
        addLog(`Rubic: Menunggu ${minutes} menit ${seconds} detik sebelum transaksi berikutnya...`, "rubic");
        await waitWithCancel(delay, "rubic");
        if (autoSwapCancelled) {
          addLog("Rubic: Auto swap dihentikan saat waktu tunggu.", "rubic");
          break;
        }
      }
    }
    autoSwapRunning = false;
    rubicSubMenu.setItems(getRubicMenuItems());
    mainMenu.setItems(getMainMenuItems());
    screen.render();
    addLog("Rubic: Auto swap selesai.", "rubic");
  });
}
function stopAutoSwap() {
  if (autoSwapRunning) {
    autoSwapCancelled = true;
  } else {
    addLog("Rubic: Tidak ada transaksi yang berjalan.", "rubic");
  }
}

async function executeTayaSwapRouteWithAmount(index, total, wallet, path, inputIsETH = true, amountInOverride, nonce = null) {
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const swapContract = new ethers.Contract(TAYA_SWAP_CONTRACT, TAYA_SWAP_ABI, wallet);
  const expectedWETH = await swapContract.WETH();
  if (inputIsETH && path[0].toLowerCase() !== expectedWETH.toLowerCase()) {
    addLog(`Taya: Error - Path harus diawali dengan alamat WETH: ${expectedWETH}`, "taya");
    return;
  }
  const amountIn = amountInOverride;
  addLog(`Taya: Swap MON ->> ${getTokenSymbol(path[1])}`, "taya");
  addLog(`Taya: Memulai Swap dengan jumlah: ${ethers.formatEther(amountIn)}`, "taya");
  try {
    const amountOutMin = 0;
    const deadline = Math.floor(Date.now() / 1000) + 300;
    const txOptions = { value: amountIn };
    if (nonce !== null) txOptions.nonce = nonce;
    let tx;
    if (inputIsETH) {
      tx = await swapContract.swapExactETHForTokens(
        amountOutMin,
        path,
        wallet.address,
        deadline,
        txOptions
      );
    } else {
      tx = await swapContract.swapExactTokensForTokens(
        amountIn,
        amountOutMin,
        path,
        wallet.address,
        deadline,
        txOptions
      );
    }
    const txHash = tx.hash;
    addLog(`Taya: Tx sent!! Tx Hash: ${getShortHash(txHash)}`, "taya");
    await tx.wait();
    addLog(`Taya: Tx confirmed!! Tx Hash: ${getShortHash(txHash)}`, "taya");
    await updateWalletData();
    addLog(`Taya: Transaksi ${index}/${total} selesai.`, "taya");
  } catch (error) {
    addLog(`Taya: Error pada transaksi ${index}: ${error.message}`, "taya");
  }
}

async function executeWrapMonToWMON(index, total, wallet, amountInOverride) {
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const router = new ethers.Contract(ROUTER_ADDRESS, ROUTER_ABI, wallet);
  const amount = amountInOverride;
  addLog(`Taya: Melakukan Swap MON ->> WMON dengan jumlah: ${ethers.formatEther(amount)}`, "taya");
  try {
    const tx = await router.deposit({ value: amount });
    const txHash = tx.hash;
    addLog(`Taya: Tx sent!! Tx Hash: ${getShortHash(txHash)}`, "taya");
    await tx.wait();
    addLog(`Taya: Tx confirmed!! Tx Hash: ${getShortHash(txHash)}`, "taya");
    await updateWalletData();
    addLog(`Taya: Transaksi ${index}/${total} selesai.`, "taya");
  } catch (error) {
    addLog(`Taya: Error pada wrap transaksi ${index}: ${error.message}`, "taya");
  }
}
async function executeUnwrapWMONToMON(index, total, wallet, amountInOverride) {
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const router = new ethers.Contract(ROUTER_ADDRESS, ROUTER_ABI, wallet);
  const amount = amountInOverride;
  addLog(`Taya: Melakukan Swap WMON ->> MON dengan jumlah: ${ethers.formatEther(amount)}`, "taya");
  try {
    const tx = await router.withdraw(amount);
    const txHash = tx.hash;
    addLog(`Taya: Tx sent!! Tx Hash: ${getShortHash(txHash)}`, "taya");
    await tx.wait();
    addLog(`Taya: Tx confirmed!! Tx Hash: ${getShortHash(txHash)}`, "taya");
    await updateWalletData();
    addLog(`Taya: Transaksi ${index}/${total} selesai.`, "taya");
  } catch (error) {
    addLog(`Taya: Error pada unwrap transaksi ${index}: ${error.message}`, "taya");
  }
}

async function runTayaAutoSwapRandom() {
  promptBox.setFront();
  promptBox.readInput("Masukkan jumlah swap Taya (Random Token):", "", async (err, value) => {
    promptBox.hide();
    screen.render();
    if (err || !value) {
      addLog("Taya: Input tidak valid atau dibatalkan.", "taya");
      return;
    }
    const loopCount = parseInt(value);
    if (isNaN(loopCount)) {
      addLog("Taya: Input tidak valid. Harus berupa angka.", "taya");
      return;
    }
    addLog(`Taya: Anda memasukkan ${loopCount} kali auto swap Taya (Random Token).`, "taya");
    if (tayaSwapRunning) {
      addLog("Taya: Transaksi sudah berjalan. Silahkan stop transaksi terlebih dahulu.", "taya");
      return;
    }
    tayaSwapRunning = true;
    tayaSwapCancelled = false;
    mainMenu.setItems(getMainMenuItems());
    tayaSubMenu.setItems(getTayaMenuItems());
    tayaSubMenu.show();
    screen.render();
    for (let i = 1; i <= loopCount; i++) {
      if (tayaSwapCancelled) {
        addLog(`Taya: Auto swap (Random Token) dihentikan pada iterasi ${i}.`, "taya");
        break;
      }
      const randomToken = TOKENS[Math.floor(Math.random() * TOKENS.length)];
      addLog(`Taya: Melakukan swap MON ->> ${getTokenSymbol(randomToken)}`, "taya");
      const path = [WMON_ADDRESS, randomToken];
      const amountIn = getRandomAmountTaya();
      addLog(`Taya: Menggunakan jumlah: ${ethers.formatEther(amountIn)}`, "taya");
      await addTransactionToQueue(async (nonce) => {
        await executeTayaSwapRouteWithAmount(i, loopCount, globalWallet, path, true, amountIn, nonce);
      }, `Taya Random Swap - Iterasi ${i}`);
      if (i < loopCount) {
        const delay = getRandomDelay();
        const minutes = Math.floor(delay / 60000);
        const seconds = Math.floor((delay % 60000) / 1000);
        addLog(`Taya: Menunggu ${minutes} menit ${seconds} detik sebelum transaksi berikutnya...`, "taya");
        await waitWithCancel(delay, "taya");
        if (tayaSwapCancelled) {
          addLog("Taya: Auto swap (Random Token) dihentikan saat waktu tunggu.", "taya");
          break;
        }
      }
    }
    tayaSwapRunning = false;
    mainMenu.setItems(getMainMenuItems());
    tayaSubMenu.setItems(getTayaMenuItems());
    screen.render();
    addLog("Taya: Auto swap (Random Token) selesai.", "taya");
  });
}


async function runTayaWrapCycle() {
  promptBox.setFront();
  promptBox.readInput("Masukkan jumlah swap Taya (MON & WMON):", "", async (err, value) => {
    promptBox.hide();
    screen.render();
    if (err || !value) {
      addLog("Taya: Input tidak valid atau dibatalkan.", "taya");
      return;
    }
    const loopCount = parseInt(value);
    if (isNaN(loopCount)) {
      addLog("Taya: Input tidak valid. Harus berupa angka.", "taya");
      return;
    }
    addLog(`Taya: Anda memasukkan ${loopCount} cycle untuk swap Taya (MON & WMON).`, "taya");
    if (tayaSwapRunning) {
      addLog("Taya: Transaksi sudah berjalan. Silahkan stop transaksi terlebih dahulu.", "taya");
      return;
    }
    tayaSwapRunning = true;
    tayaSwapCancelled = false;
    mainMenu.setItems(getMainMenuItems());
    tayaSubMenu.setItems(getTayaMenuItems());
    tayaSubMenu.show();
    screen.render();
    for (let i = 1; i <= loopCount; i++) {
      if (tayaSwapCancelled) {
        addLog(`Taya: Cycle swap dihentikan pada iterasi ${i}.`, "taya");
        break;
      }
      const amountIn = getRandomAmountTaya();
      const monBalance = ethers.parseEther(walletInfo.balanceMON);
      const wmonBalance = ethers.parseEther(walletInfo.balanceWMON);
      let operation = (i % 2 === 1) ? "wrap" : "unwrap";
      if (operation === "wrap") {
        if (monBalance < amountIn) {
          if (wmonBalance >= amountIn) {
            operation = "unwrap";
            addLog("Taya: Saldo MON tidak mencukupi, fallback ke unwrap.", "taya");
          } else {
            addLog(`Taya: Cycle ${i}: Saldo MON dan WMON tidak mencukupi.`, "taya");
            continue;
          }
        }
      } else {
        if (wmonBalance < amountIn) {
          if (monBalance >= amountIn) {
            operation = "wrap";
            addLog("Taya: Saldo WMON tidak mencukupi, fallback ke wrap.", "taya");
          } else {
            addLog(`Taya: Cycle ${i}: Saldo WMON dan MON tidak mencukupi.`, "taya");
            continue;
          }
        }
      }
      if (operation === "wrap") {
        await addTransactionToQueue(async (nonce) => {
          const provider = new ethers.JsonRpcProvider(RPC_URL);
          const router = new ethers.Contract(ROUTER_ADDRESS, ROUTER_ABI, globalWallet);
          const tx = await router.deposit({ value: amountIn, nonce: nonce });
          addLog(`Taya: Tx sent!! Tx Hash: ${getShortHash(tx.hash)}`, "taya");
          await tx.wait();
          addLog(`Taya: Tx confirmed!! Tx Hash: ${getShortHash(tx.hash)}`, "taya");
          await updateWalletData();
        }, `Taya Wrap (Cycle ${i})`);
      } else {
        await addTransactionToQueue(async (nonce) => {
          const router = new ethers.Contract(ROUTER_ADDRESS, ROUTER_ABI, globalWallet);
          const data = router.interface.encodeFunctionData("withdraw", [amountIn]);
          const tx = await globalWallet.sendTransaction({ nonce: nonce, to: ROUTER_ADDRESS, data: data });
          addLog(`Taya: Tx sent!! Tx Hash: ${getShortHash(tx.hash)}`, "taya");
          await tx.wait();
          addLog(`Taya: Tx confirmed!! Tx Hash: ${getShortHash(tx.hash)}`, "taya");
          await updateWalletData();
        }, `Taya Unwrap (Cycle ${i})`);
      }
      if (i < loopCount) {
        const delay = getRandomDelay();
        const minutes = Math.floor(delay / 60000);
        const seconds = Math.floor((delay % 60000) / 1000);
        addLog(`Taya: Menunggu ${minutes} menit ${seconds} detik sebelum cycle berikutnya...`, "taya");
        await waitWithCancel(delay, "taya");
        if (tayaSwapCancelled) {
          addLog("Taya: Cycle swap dihentikan saat waktu tunggu.", "taya");
          break;
        }
      }
    }
    tayaSwapRunning = false;
    mainMenu.setItems(getMainMenuItems());
    tayaSubMenu.setItems(getTayaMenuItems());
    screen.render();
    addLog("Taya: Swap (MON & WMON) selesai.", "taya");
  });
}
function runTayaSwap() {
  tayaSubMenu.show();
  tayaSubMenu.focus();
  screen.render();
}

async function sendTradeHistoryWithRetry(txHash, wallet, amountIn, swapToWMON = true, retries = 3, delayMs = 2000) {
  const tradePayload = swapToWMON
    ? {
        txHash: txHash,
        account: wallet.address,
        chainId: 10143,
        date: new Date().toISOString(),
        tradeSource: "EOA",
        sellTokens: [{ address: "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee", amount: amountIn }],
        buyTokens: [{ address: WMON_ADDRESS, amount: amountIn }]
      }
    : {
        txHash: txHash,
        account: wallet.address,
        chainId: 10143,
        date: new Date().toISOString(),
        tradeSource: "EOA",
        sellTokens: [{ address: WMON_ADDRESS, amount: amountIn }],
        buyTokens: [{ address: "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee", amount: amountIn }]
      };

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await axios.post("https://alpha-api.hedgemony.xyz/trade-history", tradePayload, {
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${HEDGEMONY_BEARER}`
        }
      });
      addLog(`Hedgemony: Trade history berhasil dikirim`, "hedgemony");
      return;
    } catch (error) {
      addLog(`Hedgemony: Gagal mengirim trade history (attempt ${attempt}): ${error.message}`, "hedgemony");
      if (attempt < retries) {
        await new Promise(resolve => setTimeout(resolve, delayMs));
      } else {
        addLog("Hedgemony: Semua percobaan retry trade history gagal.", "hedgemony");
      }
    }
  }
}

async function sendHedgeTradeHistoryWithRetry(txHash, wallet, amountValue, swapToHEDGE, retries = 3, delayMs = 2000) {
  const amountStr = typeof amountValue === "string" ? amountValue : amountValue.toString();
  let buyAmount;
  if (swapToHEDGE) {
    buyAmount = (BigInt(amountStr) * MON_TO_HEDGE_CONVERSION_FACTOR) / WEI_PER_ETHER;
  } else {
    buyAmount = (BigInt(amountStr) * HEDGE_TO_MON_CONVERSION_FACTOR) / WEI_PER_ETHER;
  }
  buyAmount = buyAmount.toString();

  const tradePayload = swapToHEDGE
    ? {
        txHash: txHash,
        account: wallet.address,
        chainId: 10143,
        date: new Date().toISOString(),
        tradeSource: "EOA",
        sellTokens: [{ address: "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee", amount: amountStr }],
        buyTokens: [{ address: HEDGE_ADDRESS, amount: buyAmount }]
      }
    : {
        txHash: txHash,
        account: wallet.address,
        chainId: 10143,
        date: new Date().toISOString(),
        tradeSource: "EOA",
        sellTokens: [{ address: HEDGE_ADDRESS, amount: amountStr }],
        buyTokens: [{ address: "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee", amount: buyAmount }]
      };

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await axios.post("https://alpha-api.hedgemony.xyz/trade-history", tradePayload, {
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${HEDGEMONY_BEARER}`
        }
      });
      addLog(`Hedge Swap: Trade history berhasil dikirim`, "hedgemony");
      return;
    } catch (error) {
      addLog(`Hedge Swap: Gagal mengirim trade history (attempt ${attempt}): ${error.message}`, "hedgemony");
      if (attempt < retries) {
        await new Promise(resolve => setTimeout(resolve, delayMs));
      } else {
        addLog("Hedge Swap: Semua percobaan retry trade history gagal.", "hedgemony");
      }
    }
  }
}


async function runHedgeSwap() {
  promptBox.setFront();
  promptBox.readInput("Masukkan jumlah cycle swap Mon & HEDGE:", "", async (err, value) => {
    promptBox.hide();
    screen.render();
    if (err || !value) {
      addLog("Hedge Swap: Input tidak valid atau dibatalkan.", "hedgemony");
      return;
    }
    const loopCount = parseInt(value);
    if (isNaN(loopCount) || loopCount <= 0) {
      addLog("Hedge Swap: Input tidak valid. Harus berupa angka positif.", "hedgemony");
      return;
    }
    if (hedgemonySwapRunning) {
      addLog("Hedge Swap: Transaksi sudah berjalan. Silahkan stop transaksi terlebih dahulu.", "hedgemony");
      return;
    }
    hedgemonySwapRunning = true;
    hedgemonySwapCancelled = false;
    mainMenu.setItems(getMainMenuItems());
    hedgemonySubMenu.setItems(getHedgemonyMenuItems());
    hedgemonySubMenu.show();
    hedgemonySubMenu.focus();
    screen.render();
    addLog(`Hedge Swap: Mulai auto swap sebanyak ${loopCount} cycle.`, "hedgemony");

    for (let i = 1; i <= loopCount; i++) {
      if (hedgemonySwapCancelled) {
        addLog(`Hedge Swap: Auto swap dihentikan pada cycle ke-${i}.`, "hedgemony");
        break;
      }
      let amountBN;
      const swapToHEDGE = (i % 2 === 1);
      if (swapToHEDGE) {
        amountBN = getRandomAmountMonToHedge();
        addLog(`Hedge Swap: Cycle ${i}: Akan swap MON -> HEDGE sebesar ${ethers.formatEther(amountBN)} MON`, "hedgemony");
      } else {
        amountBN = getRandomAmountHedgeToMon();
        addLog(`Hedge Swap: Cycle ${i}: Akan swap HEDGE -> MON sebesar ${ethers.formatUnits(amountBN, 18)} HEDGE`, "hedgemony");
        const hedgeContract = new ethers.Contract(HEDGE_ADDRESS, ERC20_ABI_APPROVE, globalWallet);
        const hedgeBalance = await hedgeContract.balanceOf(globalWallet.address);
        if (hedgeBalance < amountBN) {
          addLog(`Hedge Swap: Saldo HEDGE tidak cukup. Skip cycle ${i}.`, "hedgemony");
          continue;
        }
        const currentAllowance = await hedgeContract.allowance(globalWallet.address, HEDGEMONY_SWAP_CONTRACT);
        if (currentAllowance < amountBN) {
          addLog("Hedge Swap: Allowance HEDGE tidak mencukupi, melakukan approve...", "hedgemony");
          const approveTx = await hedgeContract.approve(HEDGEMONY_SWAP_CONTRACT, ethers.MaxUint256);
          addLog(`Hedge Swap: Approval tx dikirim: ${getShortHash(approveTx.hash)}`, "hedgemony");
          await approveTx.wait();
          addLog("Hedge Swap: Approval berhasil.", "hedgemony");
        }
      }

      const amountStr = amountBN.toString();
      let payload;
      if (swapToHEDGE) {
        payload = {
          chainId: 10143,
          inputTokens: [
            { address: "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee", amount: amountStr }
          ],
          outputTokens: [
            { address: HEDGE_ADDRESS, percent: 100 }
          ],
          recipient: globalWallet.address,
          slippage: 0.5
        };
      } else {
        payload = {
          chainId: 10143,
          inputTokens: [
            { address: HEDGE_ADDRESS, amount: amountStr }
          ],
          outputTokens: [
            { address: "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee", percent: 100 }
          ],
          recipient: globalWallet.address,
          slippage: 0.5
        };
      }

      try {
        const apiResponse = await axios.post("https://alpha-api.hedgemony.xyz/swap", payload, {
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${HEDGEMONY_BEARER}`
          }
        });
        const multicallTx = apiResponse.data.multicallTx;
        if (!multicallTx || !multicallTx.to || !multicallTx.data) {
          addLog(`Hedge Swap: Data transaksi tidak lengkap.`, "hedgemony");
        } else {
          await addTransactionToQueue(async (nonce) => {
            const tx = await globalWallet.sendTransaction({
              nonce: nonce,
              to: multicallTx.to,
              value: multicallTx.value ? BigInt(multicallTx.value) : 0n,
              data: multicallTx.data,
            });
            addLog(`Hedge Swap: Tx sent!! Tx Hash: ${getShortHash(tx.hash)}`, "hedgemony");
            await tx.wait();
            addLog(`Hedge Swap: Tx confirmed!! Tx Hash: ${getShortHash(tx.hash)}`, "hedgemony");
            await updateWalletData();
            await sendHedgeTradeHistoryWithRetry(tx.hash, globalWallet, amountStr, swapToHEDGE);
          }, "Hedge Swap");
          addLog(`Hedge Swap: Cycle ${i} selesai.`, "hedgemony");
        }
      } catch (error) {
        if (error.response && error.response.data) {
          addLog(`Hedge Swap: Error: ${JSON.stringify(error.response.data)}`, "hedgemony");
        } else {
          addLog(`Hedge Swap: Error: ${error.message}`, "hedgemony");
        }
      }
      if (i < loopCount) {
        const delay = getRandomDelay();
        const minutes = Math.floor(delay / 60000);
        const seconds = Math.floor((delay % 60000) / 1000);
        addLog(`Hedge Swap: Menunggu ${minutes} menit ${seconds} detik sebelum cycle berikutnya...`, "hedgemony");
        await waitWithCancel(delay, "hedgemony");
        if (hedgemonySwapCancelled) {
          addLog("Hedge Swap: Auto swap dihentikan saat waktu tunggu.", "hedgemony");
          break;
        }
      }
    }
    hedgemonySwapRunning = false;
    hedgemonySubMenu.setItems(getHedgemonyMenuItems());
    mainMenu.setItems(getMainMenuItems());
    screen.render();
    addLog("Hedge Swap: Auto swap selesai.", "hedgemony");
  });
}


async function runHedgemonySwap() {
  promptBox.setFront();
  promptBox.readInput("Masukkan jumlah swap Hedgemony :", "", async (err, value) => {
    promptBox.hide();
    screen.render();
    if (err || !value) {
      addLog("Hedgemony: Input tidak valid atau dibatalkan.", "hedgemony");
      return;
    }
    const loopCount = parseInt(value);
    if (isNaN(loopCount) || loopCount <= 0) {
      addLog("Hedgemony: Input tidak valid. Harus berupa angka positif.", "hedgemony");
      return;
    }
    if (hedgemonySwapRunning) {
      addLog("Hedgemony: Transaksi sudah berjalan. Silahkan stop transaksi terlebih dahulu.", "hedgemony");
      return;
    }
    hedgemonySwapRunning = true;
    hedgemonySwapCancelled = false;
    mainMenu.setItems(getMainMenuItems());
    hedgemonySubMenu.setItems(getHedgemonyMenuItems());
    hedgemonySubMenu.show();
    hedgemonySubMenu.focus();
    screen.render();
    addLog(`Hedgemony: Mulai auto swap sebanyak ${loopCount} kali.`, "hedgemony");
    const wmonContract = new ethers.Contract(WMON_ADDRESS, ERC20_ABI_APPROVE, globalWallet);
    for (let i = 1; i <= loopCount; i++) {
      if (hedgemonySwapCancelled) {
        addLog(`Hedgemony: Auto swap dihentikan pada iterasi ${i}.`, "hedgemony");
        break;
      }
      const swapToWMON = (i % 2 === 1);
      const amountBN = getRandomAmountHedgemony();
      const amountStr = amountBN.toString();
      if (!swapToWMON) {
        const wmonBalance = await wmonContract.balanceOf(globalWallet.address);
        addLog(`Hedgemony: Akan swap WMON ->> MON sebesar ${ethers.formatEther(amountBN)}`, "hedgemony");
        if (wmonBalance < amountBN) {
          addLog(`Hedgemony: Saldo WMON tidak cukup. Skip iterasi ${i}.`, "hedgemony");
          continue;
        }
        const currentAllowance = await wmonContract.allowance(globalWallet.address, HEDGEMONY_SWAP_CONTRACT);
        if (currentAllowance < amountBN) {
          addLog("Hedgemony: Allowance WMON tidak mencukupi, melakukan approve...", "hedgemony");
          const approveTx = await wmonContract.approve(HEDGEMONY_SWAP_CONTRACT, ethers.MaxUint256);
          addLog(`Hedgemony: Approval tx dikirim: ${getShortHash(approveTx.hash)}`, "hedgemony");
          await approveTx.wait();
          addLog("Hedgemony: Approval berhasil.", "hedgemony");
        }
      } else {
        addLog(`Hedgemony: Akan swap MON ->> WMON sebesar ${ethers.formatEther(amountBN)}`, "hedgemony");
      }
      let payload;
      if (swapToWMON) {
        payload = {
          chainId: 10143,
          inputTokens: [
            { address: "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee", amount: amountStr }
          ],
          outputTokens: [
            { address: WMON_ADDRESS, percent: 100 }
          ],
          recipient: globalWallet.address,
          slippage: 0.5
        };
      } else {
        payload = {
          chainId: 10143,
          inputTokens: [
            { address: WMON_ADDRESS, amount: amountStr }
          ],
          outputTokens: [
            { address: "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee", percent: 100 }
          ],
          recipient: globalWallet.address,
          slippage: 0.5
        };
      }
      try {
        const apiResponse = await axios.post("https://alpha-api.hedgemony.xyz/swap", payload, {
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${HEDGEMONY_BEARER}`
          }
        });
        const multicallTx = apiResponse.data.multicallTx;
        if (!multicallTx || !multicallTx.to || !multicallTx.data) {
          addLog(`Hedgemony: Data transaksi tidak lengkap.`, "hedgemony");
        } else {
          await addTransactionToQueue(async (nonce) => {
            const tx = await globalWallet.sendTransaction({
              nonce: nonce,
              to: multicallTx.to,
              value: multicallTx.value || 0,
              data: multicallTx.data,
            });
            addLog(`Hedgemony: Tx sent!! Tx Hash: ${getShortHash(tx.hash)}`, "hedgemony");
            await tx.wait();
            addLog(`Hedgemony: Tx confirmed!! Tx Hash: ${getShortHash(tx.hash)}`, "hedgemony");
            await sendTradeHistoryWithRetry(tx.hash, globalWallet, amountStr, swapToWMON);
            await updateWalletData();
          }, "Hedgemony Swap");
          addLog(`Hedgemony: ${i}/${loopCount} Swap selesai.`, "hedgemony");
        }
      } catch (error) {
        if (error.response && error.response.data) {
          addLog(`Hedgemony: Error: ${JSON.stringify(error.response.data)}`, "hedgemony");
        } else {
          addLog(`Hedgemony: Error: ${error.message}`, "hedgemony");
        }
      }
      if (i < loopCount) {
        const delay = getRandomDelay();
        const minutes = Math.floor(delay / 60000);
        const seconds = Math.floor((delay % 60000) / 1000);
        addLog(`Hedgemony: Menunggu ${minutes} menit ${seconds} detik sebelum transaksi berikutnya...`, "hedgemony");
        await waitWithCancel(delay, "hedgemony");
        if (hedgemonySwapCancelled) {
          addLog("Hedgemony: Auto swap dihentikan saat waktu tunggu.", "hedgemony");
          break;
        }
      }
    }
    hedgemonySwapRunning = false;
    hedgemonySubMenu.setItems(getHedgemonyMenuItems());
    mainMenu.setItems(getMainMenuItems());
    screen.render();
    addLog("Hedgemony: Auto swap selesai.", "hedgemony");
  });
}
function stopHedgemonySwap() {
  if (hedgemonySwapRunning) {
    hedgemonySwapCancelled = true;
    addLog("Hedgemony: Perintah Stop Transaction diterima.", "hedgemony");
  } else {
    addLog("Hedgemony: Tidak ada transaksi yang berjalan.", "hedgemony");
  }
}

mainMenu.on("select", (item) => {
  const selected = item.getText();
  if (selected === "Stop All Transactions") {
    stopAllTransactions();
    mainMenu.setItems(getMainMenuItems());
    mainMenu.focus();
    screen.render();
  } else if (selected === "Rubic Swap") {
    rubicSubMenu.show();
    rubicSubMenu.focus();
    screen.render();
  } else if (selected === "Taya Swap") {
    runTayaSwap();
  } else if (selected === "Hedgemony Swap") {
    hedgemonySubMenu.show();
    hedgemonySubMenu.focus();
    screen.render();
  } else if (selected === "Antrian Transaksi") {
    showTransactionQueueMenu();
  } else if (selected === "Clear Transaction Logs") {
    clearTransactionLogs();
  } else if (selected === "Refresh") {
    updateWalletData();
    updateLogs();
    screen.render();
    addLog("Refreshed", "system");
    mainMenu.focus();
  } else if (selected === "Exit") {
    process.exit(0);
  }
});
rubicSubMenu.on("select", (item) => {
  const selected = item.getText();
  if (selected === "Auto Swap Mon & WMON") {
    runAutoSwap();
  } else if (selected === "Stop Transaction") {
    if (autoSwapRunning) {
      autoSwapCancelled = true;
      addLog("Rubic: Perintah Stop Transaction diterima.", "rubic");
    } else {
      addLog("Rubic: Tidak ada transaksi yang berjalan.", "rubic");
    }
  } else if (selected === "Clear Transaction Logs") {
    clearTransactionLogs();
  } else if (selected === "Back To Main Menu") {
    rubicSubMenu.hide();
    mainMenu.show();
    mainMenu.focus();
    screen.render();
  } else if (selected === "Exit") {
    process.exit(0);
  }
});
function showTayaSubMenu() {
  mainMenu.hide();
  tayaSubMenu.setItems(getTayaMenuItems());
  tayaSubMenu.show();
  tayaSubMenu.focus();
  screen.render();
}
tayaSubMenu.on("select", (item) => {
  const selected = item.getText();
  if (selected === "Auto Swap Random Token") {
    runTayaAutoSwapRandom();
  } else if (selected === "Auto Swap MON & WMON") {
    runTayaWrapCycle();
  } else if (selected === "Stop Transaction") {
    if (tayaSwapRunning) {
      tayaSwapCancelled = true;
      addLog("Taya: Perintah Stop Transaction diterima.", "taya");
    } else {
      addLog("Taya: Tidak ada transaksi yang berjalan.", "taya");
    }
  } else if (selected === "Clear Transaction Logs") {
    clearTransactionLogs();
  } else if (selected === "Back To Main Menu") {
    tayaSubMenu.hide();
    mainMenu.show();
    mainMenu.focus();
    screen.render();
  } else if (selected === "Exit") {
    process.exit(0);
  }
});
function showHedgemonySubMenu() {
  mainMenu.hide();
  hedgemonySubMenu.setItems(getHedgemonyMenuItems());
  hedgemonySubMenu.show();
  hedgemonySubMenu.focus();
  screen.render();
}
hedgemonySubMenu.on("select", (item) => {
  const selected = item.getText();
  if (selected === "Auto Swap Mon & WMON") {
    runHedgemonySwap();
  } else if (selected === "Auto Swap Mon & HEDGE") {
    runHedgeSwap();
  } else if (selected === "Stop Transaction") {
    if (hedgemonySwapRunning) {
      hedgemonySwapCancelled = true;
      addLog("Hedgemony: Perintah Stop Transaction diterima.", "hedgemony");
    } else {
      addLog("Hedgemony: Tidak ada transaksi yang berjalan.", "hedgemony");
    }
  } else if (selected === "Clear Transaction Logs") {
    clearTransactionLogs();
  } else if (selected === "Back To Main Menu") {
    hedgemonySubMenu.hide();
    mainMenu.show();
    mainMenu.focus();
    screen.render();
  } else if (selected === "Exit") {
    process.exit(0);
  }
});

screen.key(["C-up"], () => { logsBox.scroll(-1); safeRender(); });
screen.key(["C-down"], () => { logsBox.scroll(1); safeRender(); });
safeRender();
mainMenu.focus();
updateLogs();
screen.render();

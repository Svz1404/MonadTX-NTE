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
const MONDA_ROUTER_ADDRESS = "0xc80585f78A6e44fb46e1445006f820448840386e";
const USDT_ADDRESS_MONDA = "0x88b8E2161DEDC77EF4ab7585569D2415a1C1055D";
const TOKEN_MLDK = "0xe9f4c0093B4e94800487cad93FBBF7C3729ccf5c";
const TOKEN_MYK  = "0x59897686b2Dd2059b09642797EBeA3d21E6cE2d1";
const TOKEN_PEPE = "0xab1fA5cc0a7dB885BC691b60eBeEbDF59354434b";
const BUBBLEFI_ROUTER_ADDRESS = "0x6c4f91880654a4F4414f50e002f361048433051B";
const BUBBLEFI_COOKIE = process.env.BUBBLEFI_COOKIE || "";
const MON_TO_HEDGE_CONVERSION_FACTOR = ethers.parseUnits("15.40493695", 18);
const HEDGE_TO_MON_CONVERSION_FACTOR = ethers.parseUnits("0.06493", 18);
const WEI_PER_ETHER = ethers.parseUnits("1", 18);
const MAX_RPC_RETRIES = 5;
const RETRY_DELAY_MS = 5000;
const bubbleFiTokens = [
  { address: TOKEN_PEPE, name: "PEPE" },
  { address: TOKEN_MLDK, name: "MLDK" },
  { address: TOKEN_MYK,  name: "MYK" }
];


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
const MONDA_ROUTER_ABI = [
  {"inputs":[{"internalType":"address","name":"_factory","type":"address"},{"internalType":"address","name":"_WETH","type":"address"}],"stateMutability":"nonpayable","type":"constructor"},
  {"inputs":[],"name":"WETH","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},
  {"inputs":[{"internalType":"address","name":"tokenA","type":"address"},{"internalType":"address","name":"tokenB","type":"address"},{"internalType":"uint256","name":"amountADesired","type":"uint256"},{"internalType":"uint256","name":"amountBDesired","type":"uint256"},{"internalType":"uint256","name":"amountAMin","type":"uint256"},{"internalType":"uint256","name":"amountBMin","type":"uint256"},{"internalType":"address","name":"to","type":"address"},{"internalType":"uint256","name":"deadline","type":"uint256"}],"name":"addLiquidity","outputs":[{"internalType":"uint256","name":"amountA","type":"uint256"},{"internalType":"uint256","name":"amountB","type":"uint256"},{"internalType":"uint256","name":"liquidity","type":"uint256"}],"stateMutability":"nonpayable","type":"function"},
  {"inputs":[{"internalType":"uint256","name":"amountOutMin","type":"uint256"},{"internalType":"address[]","name":"path","type":"address[]"},{"internalType":"address","name":"to","type":"address"},{"internalType":"uint256","name":"deadline","type":"uint256"}],"name":"swapExactETHForTokens","outputs":[{"internalType":"uint256[]","name":"amounts","type":"uint256[]"}],"stateMutability":"payable","type":"function"},
  {"inputs":[{"internalType":"uint256","name":"amountIn","type":"uint256"},{"internalType":"uint256","name":"amountOutMin","type":"uint256"},{"internalType":"address[]","name":"path","type":"address[]"},{"internalType":"address","name":"to","type":"address"},{"internalType":"uint256","name":"deadline","type":"uint256"}],"name":"swapExactTokensForETH","outputs":[{"internalType":"uint256[]","name":"amounts","type":"uint256[]"}],"stateMutability":"nonpayable","type":"function"}
];

const BUBBLEFI_ROUTER_ABI = [
  {
    "inputs": [
      { "internalType": "uint256", "name": "_amountIn", "type": "uint256" },
      { "internalType": "uint256", "name": "_amountOutMin", "type": "uint256" },
      { "internalType": "address[]", "name": "_path", "type": "address[]" },
      { "internalType": "address", "name": "_receiver", "type": "address" },
      { "internalType": "uint256", "name": "_deadline", "type": "uint256" },
      {
        "components": [
          { "internalType": "bool", "name": "enter", "type": "bool" },
          {
            "components": [
              { "internalType": "uint256", "name": "numerator", "type": "uint256" },
              { "internalType": "uint256", "name": "denominator", "type": "uint256" }
            ],
            "internalType": "struct MonadexV1Types.Fraction",
            "name": "fractionOfSwapAmount",
            "type": "tuple"
          },
          { "internalType": "address", "name": "raffleNftReceiver", "type": "address" }
        ],
        "internalType": "struct MonadexV1Types.Raffle",
        "name": "_raffle",
        "type": "tuple"
      }
    ],
    "name": "swapExactTokensForTokens",
    "outputs": [
      { "internalType": "uint256[]", "name": "", "type": "uint256[]" },
      { "internalType": "uint256", "name": "", "type": "uint256" }
    ],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "uint256", "name": "_amountIn", "type": "uint256" },
      { "internalType": "address[]", "name": "_path", "type": "address[]" }
    ],
    "name": "getAmountsOut",
    "outputs": [
      { "internalType": "uint256[]", "name": "", "type": "uint256[]" }
    ],
    "stateMutability": "view",
    "type": "function"
  }
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
let mondaSwapRunning = false;
let mondaSwapCancelled = false;
let bubbleFiSwapRunning = false;
let bubbleFiSwapCancelled = false;
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

// Random Ammount untuk Rubic 
function getRandomAmount() {
  const min = 0.005, max = 0.01;
  const randomVal = Math.random() * (max - min) + min;
  return ethers.parseEther(randomVal.toFixed(6));
}

// Random Ammount untuk Taya 
function getRandomAmountTaya() {
  const min = 0.005, max = 0.01;
  const randomVal = Math.random() * (max - min) + min;
  return ethers.parseEther(randomVal.toFixed(6));
}

// Random Ammount untuk Hedgemony Mon - Wmon
function getRandomAmountHedgemony() {
  const min = 0.003, max = 0.01;
  const randomVal = Math.random() * (max - min) + min;
  return ethers.parseEther(randomVal.toFixed(6));
}

// Random ammount $MON (Hedgemony)
function getRandomAmountMonToHedge() {
  const min = 0.01, max = 0.05;
  const randomVal = Math.random() * (max - min) + min;
  return ethers.parseUnits(randomVal.toFixed(6), 18);
}

// Random ammount $HEDGE (Hedgemony)
function getRandomAmountHedgeToMon() {
  const min = 400, max = 1000;
  const randomInt = Math.floor(Math.random() * (max - min + 1)) + min;
  return ethers.parseUnits(randomInt.toString(), 18);
}

// Random Ammount Monda untuk  Dak -> Mon
  function getRandomAmountDakForSwap() {
    const min = 0.3, max = 4;
    const randomVal = Math.random() * (max - min) + min;
    return ethers.parseUnits(randomVal.toFixed(6), 18);
  }

// Random Ammount Monda untuk  Mon -> Dak
 function getRandomAmountMonForSwap() {
    const min = 0.1, max = 1;
    const randomVal = Math.random() * (max - min) + min;
    return ethers.parseUnits(randomVal.toFixed(6), 18);
  }

// Random Ammount Monda untuk Mon -> usdc/usdt 
function getRandomAmountMonForUsdcUsdt() {
    const min = 1 , max = 4;
    const randomVal = Math.random() * (max - min) + min;
    return ethers.parseEther(randomVal.toFixed(6)); 
  }

// Random Ammount Monda untuk usdc -> Mon
  function getRandomAmountUsdcForSwap() {
    const min = 10, max = 43 ;
    const randomVal = Math.random() * (max - min) + min;
    return ethers.parseUnits(randomVal.toFixed(6), 6);
  }

  // Random Ammount Monda untuk usdt -> Mon
  function getRandomAmountUsdtForSwap() {
    const min = 11, max = 43;
    const randomVal = Math.random() * (max - min) + min;
    return ethers.parseUnits(randomVal.toFixed(6), 6); 
  }

// Random Ammount Bubblefi PEPE - MLDK - MYK
  function getRandomAmountBubbleFi() {
    const min = 5;
    const max = 15;
    const randomVal = Math.random() * (max - min) + min;
    return ethers.parseUnits(randomVal.toFixed(6), 18);
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
  } else if (type === "monda") {
    coloredMessage = `{bright-blue-fg}${message}{/bright-blue-fg}`;
  } else if (type === "bubblefi") {
    coloredMessage = `{bright-green-fg}${message}{/bright-green-fg}`;
  }
  transactionLogs.push(`[ {bold}{grey-fg}${timestamp}{/grey-fg}{/bold} ] ${coloredMessage}`);
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
figlet.text("NT Exhaust".toUpperCase(), { font: "Speed", horizontalLayout: "default" }, (err, data) => {
  if (err) headerBox.setContent("{center}{bold}MONAD AUTO SWAP{/bold}{/center}");
  else headerBox.setContent(`{center}{bold}{bright-cyan-fg}${data}{/bright-cyan-fg}{/bold}{/center}`);
  safeRender();
});
const descriptionBox = blessed.box({
  left: "center",
  width: "100%",
  content: "{center}{bold}{bright-cyan-fg}➕➕➕➕ MONAD AUTO SWAP ➕➕➕➕{/bright-cyan-fg}{/bold}{/center}",
  tags: true,
  style: { fg: "white", bg: "default" }
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
  tags: true,
  border: { type: "line" },
  style: { border: { fg: "magenta" }, fg: "white", bg: "default", align: "left", valign: "top" },
  content: ""
});

function updateWallet() {
  const shortAddress = walletInfo.address
    ? walletInfo.address.slice(0, 6) + "..." + walletInfo.address.slice(-4)
    : "N/A";

  const formatBalance = (balance) => {
    return Number(balance).toFixed(2);
  };

  const mon   = walletInfo.balanceMON ? formatBalance(walletInfo.balanceMON) : "0.00";
  const wmon  = walletInfo.balanceWMON ? formatBalance(walletInfo.balanceWMON) : "0.00";
  const hedge = walletInfo.balanceHEDGE ? formatBalance(walletInfo.balanceHEDGE) : "0.00";
  const weth  = walletInfo.balanceWETH ? formatBalance(walletInfo.balanceWETH) : "0.00";
  const usdt  = walletInfo.balanceUSDT ? formatBalance(walletInfo.balanceUSDT) : "0.00";
  const usdc  = walletInfo.balanceUSDC ? formatBalance(walletInfo.balanceUSDC) : "0.00";
  const network = walletInfo.network || "Unknown";

  const content = `Address : {bold}{bright-cyan-fg}${shortAddress}{/bright-cyan-fg}{/bold}
└── Network : {bold}{bright-yellow-fg}${network}{/bright-yellow-fg}{/bold}
    ├── MON   : {bold}{bright-green-fg}${mon}{/bright-green-fg}{/bold}
    ├── WMON  : {bold}{bright-green-fg}${wmon}{/bright-green-fg}{/bold}
    ├── HEDGE : {bold}{bright-green-fg}${hedge}{/bright-green-fg}{/bold}
    ├── WETH  : {bold}{bright-green-fg}${weth}{/bright-green-fg}{/bold}
    ├── USDC  : {bold}{bright-green-fg}${usdc}{/bright-green-fg}{/bold}
    └── USDT  : {bold}{bright-green-fg}${usdt}{/bright-green-fg}{/bold}
`;

  walletBox.setContent(content);
  safeRender();
}

function stopAllTransactions() {
  if (autoSwapRunning || tayaSwapRunning || hedgemonySwapRunning || mondaSwapRunning) {
    autoSwapCancelled = true;
    tayaSwapCancelled = true;
    hedgemonySwapCancelled = true;
    mondaSwapCancelled = true;
    bubbleFiSwapCancelled = true;
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
function getMondaMenuItems() {
    return mondaSwapRunning
      ? ["Auto Swap Mon & Dak", "Auto Swap Mon & USDC/USDT", "{grey-fg}Auto Swap Mon & Monda [COMING SOON]{/grey-fg}", "Stop Transaction", "Clear Transaction Logs", "Back To Main Menu", "Exit"]
      : ["Auto Swap Mon & Dak", "Auto Swap Mon & USDC/USDT", "{grey-fg}Auto Swap Mon & Monda [COMING SOON]{/grey-fg}", "Clear Transaction Logs", "Back To Main Menu", "Exit"];
  }
function getBubbleFiMenuItems() {
    return bubbleFiSwapRunning
      ? ["Auto Swap Pepe & Mldk & Myk", "Stop Transaction", "Clear Transaction Logs", "Back To Main Menu", "Exit"]
      : ["Auto Swap Pepe & Mldk & Myk", "Clear Transaction Logs", "Back To Main Menu", "Exit"];
  }



function getMainMenuItems() {
    let items = ["Rubic Swap", "Taya Swap", "Hedgemony Swap", "Monda Swap", "BubbleFi Swap", "Antrian Transaksi", "Clear Transaction Logs", "Refresh", "Exit"];
    if (autoSwapRunning || tayaSwapRunning || hedgemonySwapRunning || mondaSwapRunning || bubbleFiSwapRunning) {
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
  style: { fg: "white", bg: "default", border: { fg: "yellow" }, selected: { bg: "magenta", fg: "black" } },
  items: getHedgemonyMenuItems()
});
hedgemonySubMenu.hide();
const mondaSubMenu = blessed.list({
  label: " Monda Swap Menu ",
  left: "60%",
  keys: true,
  tags: true,
  vi: true,
  mouse: true,
  border: { type: "line" },
  style: {
    fg: "white",
    bg: "default",
    border: { fg: "yellow" },
    selected: { bg: "blue", fg: "black" }
  },
  items: getMondaMenuItems()
});
mondaSubMenu.hide();
const bubbleFiSubMenu = blessed.list({
    label: " BubbleFi Swap Menu ",
    left: "60%",
    keys: true,
    vi: true,
    mouse: true,
    border: { type: "line" },
    style: {
      fg: "white",
      bg: "default",
      border: { fg: "yellow" },
      selected: { bg: "magenta", fg: "black" }
    },
    items: getBubbleFiMenuItems(),
    tags: true
  });
bubbleFiSubMenu.hide();
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
screen.append(mondaSubMenu);
screen.append(bubbleFiSubMenu);


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
  mondaSubMenu.top = mainMenu.top;
  mondaSubMenu.left = mainMenu.left;
  mondaSubMenu.width = mainMenu.width;
  mondaSubMenu.height = mainMenu.height;
  bubbleFiSubMenu.top = mainMenu.top;
  bubbleFiSubMenu.left = mainMenu.left;
  bubbleFiSubMenu.width = mainMenu.width;
  bubbleFiSubMenu.height = mainMenu.height;

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
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
    globalWallet = wallet;
    walletInfo.address = wallet.address;

    const [
      balanceMON,
      balanceWMON,
      balanceHEDGE,
      balanceWETH,
      balanceUSDC,
      balanceUSDT
    ] = await Promise.all([
      provider.getBalance(wallet.address),
      new ethers.Contract(WMON_ADDRESS, ERC20_ABI, provider).balanceOf(wallet.address),
      new ethers.Contract(HEDGE_ADDRESS, ERC20_ABI, provider).balanceOf(wallet.address),
      new ethers.Contract(WETH_ADDRESS, ERC20_ABI, provider).balanceOf(wallet.address),
      new ethers.Contract(USDC_ADDRESS, ERC20_ABI, provider).balanceOf(wallet.address),
      new ethers.Contract(USDT_ADDRESS_MONDA, ERC20_ABI, provider).balanceOf(wallet.address)
    ]);

    walletInfo.balanceMON   = ethers.formatEther(balanceMON);
    walletInfo.balanceWMON  = ethers.formatEther(balanceWMON);
    walletInfo.balanceHEDGE = ethers.formatEther(balanceHEDGE);
    walletInfo.balanceWETH  = ethers.formatEther(balanceWETH);
    walletInfo.balanceUSDC  = ethers.formatUnits(balanceUSDC, 6);
    walletInfo.balanceUSDT  = ethers.formatUnits(balanceUSDT, 6);

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
        if (type === "monda" && mondaSwapCancelled) { clearInterval(interval); resolve(); }
        if (type === "bubblefi" && bubbleFiSwapCancelled) { clearInterval(interval); resolve(); }
      }, 100);
    })
  ]);
}

async function endInitialRubicRequest(txHash, walletAddress, amount, swapToWMON) {
  try {
    const amountStr = amount.toString();
    const payload = {
      price_impact: null,
      walletName: "metamask",
      deviceType: "desktop",
      slippage: 0,
      expected_amount: amountStr,
      mevbot_protection: false,
      to_amount_min: amountStr,
      network: "monad-testnet",
      provider: "wrapped",
      from_token: swapToWMON ? "0x0000000000000000000000000000000000000000" : ROUTER_ADDRESS,
      to_token: swapToWMON ? ROUTER_ADDRESS : "0x0000000000000000000000000000000000000000",
      from_amount: amountStr,
      to_amount: amountStr,
      user: walletAddress,
      hash: txHash,
    };

    const response = await axios.post(`${RUBIC_API_URL}?valid=false`, payload, {
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json, text/plain, */*",
        Origin: "https://testnet.rubic.exchange",
        Referer: "https://testnet.rubic.exchange/",
        Cookie: RUBIC_COOKIE,
      },
    });

    addLog(`Rubic: Transaksi terkirim!! Tx Hash: ${getShortHash(txHash)}`, "rubic");
  } catch (error) {
    addLog(`Rubic: Error in initial Rubic API request: ${error.message}`, "rubic");
  }
}

async function executeSwap(index, total, wallet, swapToWMON, skipDelay = false) {
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const router = new ethers.Contract(ROUTER_ADDRESS, ROUTER_ABI, wallet);
  const amount = getRandomAmount();
  addLog(`Rubic: Memulai swap ${swapToWMON ? "MON ➯ WMON" : "WMON ➯ MON"} dengan jumlah ${ethers.formatEther(amount)}`, "rubic");
  try {
    const tx = swapToWMON
      ? await router.deposit({ value: amount })
      : await router.withdraw(amount);
    const txHash = tx.hash;
    addLog(`Rubic: Tx Sended....`, "rubic");
    await tx.wait();
    addLog(`Rubic: Tx Confirmed!!!!`, "rubic");
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
        addLog(`Rubic: Memulai swap ${swapToWMON ? "MON ➯ WMON" : "WMON ➯ MON"} dengan jumlah ${ethers.formatEther(amount)}`, "rubic");
        const tx = swapToWMON
          ? await router.deposit({ value: amount, nonce: nonce })
          : await router.withdraw(amount, { nonce: nonce });
        addLog(`Rubic: Tx Sended....`, "rubic");
        await tx.wait();
        addLog(`Rubic: Tx Confirmed!!!`, "rubic");
        await endInitialRubicRequest(tx.hash, globalWallet.address, amount, swapToWMON);
        await sendRubicRequest(tx.hash, globalWallet.address, swapToWMON);
        await checkRubicRewards(globalWallet.address);
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
  addLog(`Taya: Swap MON ➯ ${getTokenSymbol(path[1])}`, "taya");
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
  addLog(`Taya: Melakukan Swap MON ➯ WMON dengan jumlah: ${ethers.formatEther(amount)}`, "taya");
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
  addLog(`Taya: Melakukan Swap WMON ➯ MON dengan jumlah: ${ethers.formatEther(amount)}`, "taya");
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
      addLog(`Taya: Melakukan swap MON ➯ ${getTokenSymbol(randomToken)}`, "taya");
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
        addLog(`Hedgemony: Akan swap WMON ➯ MON sebesar ${ethers.formatEther(amountBN)}`, "hedgemony");
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
        addLog(`Hedgemony: Akan swap MON ➯ WMON sebesar ${ethers.formatEther(amountBN)}`, "hedgemony");
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
        addLog(`HedgemonySwap: Menunggu ${minutes} menit ${seconds} detik sebelum transaksi berikutnya...`, "hedgemony");
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

async function runMondaSwapMonDak() {
    promptBox.setFront();
    promptBox.readInput("Masukkan jumlah cycle untuk swap MON & DAK:", "", async (err, value) => {
      promptBox.hide();
      mondaSubMenu.show();
      mondaSubMenu.focus();
      screen.render();
      if (err || !value) {
        addLog("MondaSwap: Input tidak valid atau dibatalkan.", "monda");
        return;
      }
      const loopCount = parseInt(value);
      if (isNaN(loopCount)) {
        addLog("MondaSwap: Input tidak valid. Harus berupa angka.", "monda");
        return;
      }
      addLog(`MondaSwap: Anda memasukkan ${loopCount} cycle untuk swap MON & DAK.`, "monda");
      if (mondaSwapRunning) {
        addLog("MondaSwap: Transaksi sudah berjalan. Silahkan stop transaksi terlebih dahulu.", "monda");
        return;
      }
      mondaSwapRunning = true;
      mondaSwapCancelled = false;
      mainMenu.setItems(getMainMenuItems());
      mondaSubMenu.setItems(getMondaMenuItems());
      mondaSubMenu.show();
      mondaSubMenu.focus();
      screen.render();
      const mondaRouter = new ethers.Contract(
        "0xc80585f78A6e44fb46e1445006f820448840386e",
        MONDA_ROUTER_ABI,
        globalWallet
      );
      const routerWETH = await mondaRouter.WETH();
      const provider = new ethers.JsonRpcProvider(RPC_URL);
      const DAK_ADDRESS = "0x0F0BDEbF0F83cD1EE3974779Bcb7315f9808c714";

      for (let i = 1; i <= loopCount; i++) {
        if (mondaSwapCancelled) {
          addLog(`MondaSwap: Auto swap MON & DAK dihentikan pada iterasi ${i}.`, "monda");
          break;
        }
        if (i % 2 === 1) {
          const amountIn = getRandomAmountMonForSwap();
          const balanceMON = await provider.getBalance(globalWallet.address);
          if (balanceMON < amountIn) {
            addLog(`Monda: Saldo MON tidak cukup untuk swap MON → DAK.`, "monda");
            continue;
          }
          const expectedOutput = getRandomAmountDakForSwap(); 
          const amountOutMin = (expectedOutput * 980n) / 1000n;
          const deadline = Math.floor(Date.now() / 1000) + 300;
          let path = [routerWETH, DAK_ADDRESS];
          addLog(`Monda: Swap MON ➯ DAK Dengan Jumlah ${ethers.formatEther(amountIn)} MON`, "monda");
          await addTransactionToQueue(async (nonce) => {
            const tx = await mondaRouter.swapExactETHForTokens(
              amountOutMin,
              path,
              globalWallet.address,
              deadline,
              { value: amountIn, nonce: nonce }
            );
            addLog(`Monda: Tx sent: ${getShortHash(tx.hash)}`, "monda");
            await tx.wait();
            addLog(`Monda: Tx confirmed.`, "monda");
            await updateWalletData();
          }, `Monda Swap MON ➯ DAK`);
        } else {
          const amountIn = getRandomAmountDakForSwap();
          const tokenContract = new ethers.Contract(DAK_ADDRESS, ERC20_ABI, provider);
          const tokenBalance = await tokenContract.balanceOf(globalWallet.address);
          if (tokenBalance < amountIn) {
            addLog(`Monda: Saldo DAK tidak cukup untuk swap DAK → MON.`, "monda");
            continue;
          }
          const tokenContractApprove = new ethers.Contract(DAK_ADDRESS, ERC20_ABI_APPROVE, globalWallet);
          const currentAllowance = await tokenContractApprove.allowance(globalWallet.address, "0xc80585f78A6e44fb46e1445006f820448840386e");
          if (currentAllowance < amountIn) {
            addLog(`Monda: Approving DAK...`, "monda");
            const approveTx = await tokenContractApprove.approve("0xc80585f78A6e44fb46e1445006f820448840386e", ethers.MaxUint256);
            await approveTx.wait();
            addLog(`Monda: Approval DAK berhasil.`, "monda");
          }
          const expectedOutput = getRandomAmountMonForSwap(); 
          const amountOutMin = (expectedOutput * 980n) / 1000n;
          const deadline = Math.floor(Date.now() / 1000) + 300;
          let path = [DAK_ADDRESS, routerWETH];
          addLog(`Monda: Swap DAK ➯ MON Dengan Jumlah ${ethers.formatUnits(amountIn,18)} DAK`, "monda");
          await addTransactionToQueue(async (nonce) => {
            const tx = await mondaRouter.swapExactTokensForETH(
              amountIn,
              amountOutMin,
              path,
              globalWallet.address,
              deadline,
              { nonce: nonce }
            );
            addLog(`Monda: Tx sent: ${getShortHash(tx.hash)}`, "monda");
            await tx.wait();
            addLog(`Monda: Tx confirmed.`, "monda");
            await updateWalletData();
          }, `Monda Swap DAK ➯ MON`);
        }
        if (i < loopCount) {
          const delay = getRandomDelay();
          const minutes = Math.floor(delay / 60000);
          const seconds = Math.floor((delay % 60000) / 1000);
          addLog(`MondaSwap:Cycle Ke ${i} Selesai`);
          addLog(`MondaSwap: Menunggu ${minutes} menit ${seconds} detik sebelum cycle berikutnya...`, "monda");
          await waitWithCancel(delay, "monda");
          if (mondaSwapCancelled) {
            addLog(`Monda: Auto swap dihentikan saat waktu tunggu.`, "monda");
            break;
          }
        }
      }
      mondaSwapRunning = false;
      mainMenu.setItems(getMainMenuItems());
      mondaSubMenu.setItems(getMondaMenuItems());
      screen.render();
      addLog("MondaSwap: Auto swap MON & DAK selesai.", "monda");
      mondaSubMenu.focus();
    });
  }


async function runMondaSwapMonUsdcUsdt() {
  promptBox.show();
  promptBox.setFront();
  promptBox.readInput("Masukkan jumlah cycle untuk swap MON/USDC/USDT:", "", async (err, value) => {
    promptBox.hide();
    mondaSubMenu.show();
    mondaSubMenu.focus();
    screen.render();
    if (err || !value) {
      addLog("MondaSwap: Input tidak valid atau dibatalkan.", "monda");
      return;
    }
    const loopCount = parseInt(value);
    if (isNaN(loopCount)) {
      addLog("MondaSwap: Input tidak valid. Harus berupa angka.", "monda");
      return;
    }
    addLog(`MondaSwap: Anda memasukkan ${loopCount} cycle untuk swap MON/USDC/USDT.`, "monda");

    mondaSwapRunning = true;
    mondaSwapCancelled = false;
    mainMenu.setItems(getMainMenuItems());
    mondaSubMenu.setItems(getMondaMenuItems());
    mondaSubMenu.show();
    mondaSubMenu.focus();
    screen.render();

    const mondaRouter = new ethers.Contract(
      "0xc80585f78A6e44fb46e1445006f820448840386e",
      MONDA_ROUTER_ABI,
      globalWallet
    );
    const routerWETH = await mondaRouter.WETH();
    const provider = new ethers.JsonRpcProvider(RPC_URL);

    for (let i = 1; i <= loopCount; i++) {
      if (mondaSwapCancelled) {
        addLog(`MondaSwap: Auto swap MON/USDC/USDT dihentikan pada iterasi ${i}.`, "monda");
        break;
      }

      let useUSDC = ((i - 1) % 4) < 2;
      let targetToken = useUSDC ? USDC_ADDRESS : "0x88b8E2161DEDC77EF4ab7585569D2415a1C1055D";

      if (i % 2 === 1) {
        const amountIn = getRandomAmountMonForUsdcUsdt();
        const balanceMON = await provider.getBalance(globalWallet.address);
        if (balanceMON < amountIn) {
          addLog(`Monda: Saldo MON tidak cukup untuk swap MON → ${useUSDC ? "USDC" : "USDT"}.`, "monda");
          continue;
        }
        const expectedOutput = useUSDC ? getRandomAmountUsdcForSwap() : getRandomAmountUsdtForSwap();
        const amountOutMin = 0n;
        const deadline = Math.floor(Date.now() / 1000) + 300;
        const path = [routerWETH, targetToken];
        addLog(`Monda: Swap MON ➯ ${useUSDC ? "USDC" : "USDT"} Dengan Jumlah: ${ethers.formatEther(amountIn)} MON`, "monda");
        await addTransactionToQueue(async (nonce) => {
          const tx = await mondaRouter.swapExactETHForTokens(
            amountOutMin,
            path,
            globalWallet.address,
            deadline,
            { value: amountIn, nonce: nonce }
          );
          addLog(`Monda: Tx sent: ${getShortHash(tx.hash)}`, "monda");
          await tx.wait();
          addLog(`Monda: Tx confirmed.`, "monda");
          await updateWalletData();
        }, `Monda Swap MON ➯ ${useUSDC ? "USDC" : "USDT"}`);
      } else {
        const decimals = 6;
        const amountIn = useUSDC ? getRandomAmountUsdcForSwap() : getRandomAmountUsdtForSwap();
        const tokenContract = new ethers.Contract(targetToken, ERC20_ABI, provider);
        const tokenBalance = await tokenContract.balanceOf(globalWallet.address);
        if (tokenBalance < amountIn) {
          addLog(`Monda: Saldo ${useUSDC ? "USDC" : "USDT"} tidak cukup untuk swap ke MON.`, "monda");
          continue;
        }
        const tokenContractApprove = new ethers.Contract(targetToken, ERC20_ABI_APPROVE, globalWallet);
        const currentAllowance = await tokenContractApprove.allowance(globalWallet.address, "0xc80585f78A6e44fb46e1445006f820448840386e");
        if (currentAllowance < amountIn) {
          addLog(`Monda: Approving ${useUSDC ? "USDC" : "USDT"}...`, "monda");
          const approveTx = await tokenContractApprove.approve("0xc80585f78A6e44fb46e1445006f820448840386e", ethers.MaxUint256);
          await approveTx.wait();
          addLog(`Monda: Approval ${useUSDC ? "USDC" : "USDT"} berhasil.`, "monda");
        }
        const expectedOutput = getRandomAmountMonForUsdcUsdt();
        const amountOutMin = 0n; 
        const deadline = Math.floor(Date.now() / 1000) + 300;
        const path = [targetToken, routerWETH];
        addLog(`Monda: Swap ${useUSDC ? "USDC" : "USDT"} ➯ MON Dengan Jumlah: ${ethers.formatUnits(amountIn, decimals)} ${useUSDC ? "USDC" : "USDT"}`, "monda");
        await addTransactionToQueue(async (nonce) => {
          const tx = await mondaRouter.swapExactTokensForETH(
            amountIn,
            amountOutMin,
            path,
            globalWallet.address,
            deadline,
            { nonce: nonce }
          );
          addLog(`Monda: Tx sent: ${getShortHash(tx.hash)}`, "monda");
          await tx.wait();
          addLog(`Monda: Tx confirmed ${getShortHash(tx.hash)}`, "monda");
          await updateWalletData();
        }, `Monda Swap ${useUSDC ? "USDC" : "USDT"} ➯ MON`);
      }
      if (i < loopCount) {
        const delay = getRandomDelay();
        const minutes = Math.floor(delay / 60000);
        const seconds = Math.floor((delay % 60000) / 1000);
        addLog(`Monda: Cycle Ke ${i} Selesai`);
        addLog(`Monda: Menunggu ${minutes} menit ${seconds} detik sebelum cycle berikutnya...`, "monda");
        await waitWithCancel(delay, "monda");
        if (mondaSwapCancelled) {
          addLog(`Monda: Auto swap dihentikan saat waktu tunggu.`, "monda");
          break;
        }
      }
    }
    mondaSwapRunning = false;
    mainMenu.setItems(getMainMenuItems());
    mondaSubMenu.setItems(getMondaMenuItems());
    screen.render();
    addLog("MondaSwap: Auto swap MON/USDC/USDT selesai.", "monda");
    mondaSubMenu.focus();
  });
}


async function runMondaSwapMonMonda() {
  promptBox.setFront();
  promptBox.readInput("Masukkan jumlah swap Monda (Mon & Monda):", "", async (err, value) => {
    promptBox.hide();
    mondaSubMenu.show();
    mondaSubMenu.focus();
    screen.render();
    if (err || !value) {
      addLog("MondaSwap: Input tidak valid atau dibatalkan.", "monda");
      return;
    }
    const loopCount = parseInt(value);
    if (isNaN(loopCount)) {
      addLog("MondaSwap: Input tidak valid. Harus berupa angka.", "monda");
      return;
    }
    addLog(`MondaSwap: Anda memasukkan ${loopCount} kali auto swap Mon & Monda.`, "monda");
    if (mondaSwapRunning) {
      addLog("MondaSwap: Transaksi sudah berjalan. Silahkan stop transaksi terlebih dahulu.", "monda");
      return;
    }
    mondaSwapRunning = true;
    mondaSwapCancelled = false;
    mainMenu.setItems(getMainMenuItems());
    mondaSubMenu.setItems(getMondaMenuItems());
    mondaSubMenu.show();
    mondaSubMenu.focus();
    screen.render();
    for (let i = 1; i <= loopCount; i++) {
      if (mondaSwapCancelled) {
        addLog(`MondaSwap: Auto swap Mon & Monda dihentikan pada iterasi ${i}.`, "monda");
        break;
      }
      await addTransactionToQueue(async (nonce) => {
        addLog(`MondaSwap: Iterasi ${i}: Melakukan swap Mon & Monda.`, "monda");
        await new Promise(resolve => setTimeout(resolve, 1000));
      }, `Monda Swap Mon ➯ Monda`);
      if (i < loopCount) {
        const delay = getRandomDelay();
        const minutes = Math.floor(delay / 60000);
        const seconds = Math.floor((delay % 60000) / 1000);
        addLog(`MondaSwap: Cycle Ke ${i} Selesai`, "monda");
        addLog(`MondaSwap: Menunggu ${minutes} menit ${seconds} detik sebelum transaksi berikutnya...`, "monda");
        await waitWithCancel(delay, "monda");
        if (mondaSwapCancelled) {
          addLog("Monda: Auto swap dihentikan saat waktu tunggu.", "monda");
          break;
        }
      }
    }
    mondaSwapRunning = false;
    mainMenu.setItems(getMainMenuItems());
    mondaSubMenu.setItems(getMondaMenuItems());
    screen.render();
    addLog("MondaSwap: Auto swap Mon & Monda selesai.", "monda");
    mondaSubMenu.focus();
  });
}

async function runBubbleFiAutoSwap() {
  promptBox.setFront();
  promptBox.readInput("Masukkan jumlah swap BubbleFi:", "", async (err, value) => {
    promptBox.hide();
    screen.render();
    if (err || !value) {
      addLog("BubbleFi: Input tidak valid atau dibatalkan.", "bubblefi");
      return;
    }
    const loopCount = parseInt(value);
    if (isNaN(loopCount) || loopCount <= 0) {
      addLog("BubbleFi: Input tidak valid. Harus berupa angka positif.", "bubblefi");
      return;
    }
    addLog(`BubbleFi: Anda memasukkan ${loopCount} kali swap BubbleFi.`, "bubblefi");
    if (bubbleFiSwapRunning) {
      addLog("BubbleFi: Transaksi sudah berjalan. Silahkan stop transaksi terlebih dahulu.", "bubblefi");
      return;
    }
    bubbleFiSwapRunning = true;
    bubbleFiSwapCancelled = false;
    mainMenu.setItems(getMainMenuItems());
    bubbleFiSubMenu.setItems(getBubbleFiMenuItems());
    bubbleFiSubMenu.show();
    screen.render();
    let userId;
    try {
      const sessionResponse = await axios.get( "https://api.bubblefi.xyz/auth/session", {
        headers: { 
             "Content-Type": "application/json",
              Cookie: BUBBLEFI_COOKIE,
              "origin": "https://app.bubblefi.xyz",
              "referer": "https://app.bubblefi.xyz/",
              "user-agent":  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36"
        }
      });
      userId = sessionResponse.data.user.id;
      addLog(`BubbleFi: Diperoleh session untuk user id ${userId}`, "bubblefi");
    } catch (error) {
      addLog(`BubbleFi: Gagal mendapatkan session: ${error.message}`, "bubblefi");
      bubbleFiSwapRunning = false;
      return;
    }

    const tokens = [
      { address: TOKEN_PEPE, name: "PEPE" },
      { address: TOKEN_MLDK, name: "MLDK" },
      { address: TOKEN_MYK,  name: "MYK" }
    ];

    for (let i = 1; i <= loopCount; i++) {
      if (bubbleFiSwapCancelled) {
        addLog(`BubbleFi: Swap dibatalkan pada Cycle ke ${i}.`, "bubblefi");
        break;
      }

      const indexFrom = Math.floor(Math.random() * tokens.length);
      let indexTo;
      do {
        indexTo = Math.floor(Math.random() * tokens.length);
      } while (indexTo === indexFrom);
      const fromToken = tokens[indexFrom];
      const toToken = tokens[indexTo];
      const amountToSwap = getRandomAmountBubbleFi();
      const fromTokenContract = new ethers.Contract(fromToken.address, ERC20_ABI, globalWallet.provider);
      const balance = await fromTokenContract.balanceOf(globalWallet.address);
      if (balance < amountToSwap) {
        addLog(`BubbleFi:  Saldo ${fromToken.name} (${ethers.formatUnits(balance, 18)}) tidak mencukupi untuk swap ${ethers.formatUnits(amountToSwap, 18)}. Melewati iterasi ini.`, "bubblefi");
        continue;
      }

      addLog(`BubbleFi: Swap ${fromToken.name} ➯ ${toToken.name} dengan jumlah ${ethers.formatUnits(amountToSwap, 18)}`, "bubblefi");

      await addTransactionToQueue(async (nonce) => {
        const fromTokenContractApprove = new ethers.Contract(fromToken.address, ERC20_ABI_APPROVE, globalWallet);
        const currentAllowance = await fromTokenContractApprove.allowance(globalWallet.address, BUBBLEFI_ROUTER_ADDRESS);
        if (currentAllowance < amountToSwap) {
          addLog(`BubbleFi: Approval ${fromToken.name} diperlukan.`, "bubblefi");
          const approveTx = await fromTokenContractApprove.approve(BUBBLEFI_ROUTER_ADDRESS, ethers.MaxUint256, { nonce });
          addLog(`BubbleFi: Tx approval ${fromToken.name} dikirim: ${getShortHash(approveTx.hash)}`, "bubblefi");
          await approveTx.wait();
          addLog(`BubbleFi: Approval ${fromToken.name} berhasil.`, "bubblefi");
        }
        const bubbleFiRouter = new ethers.Contract(BUBBLEFI_ROUTER_ADDRESS, BUBBLEFI_ROUTER_ABI, globalWallet);
        const swapPath = [fromToken.address, toToken.address];
        let estimatedAmounts;
        try {
          estimatedAmounts = await bubbleFiRouter.getAmountsOut(amountToSwap, swapPath);
        } catch (error) {
          addLog(`BubbleFi: getAmountsOut gagal: ${error.message}`, "bubblefi");
          return;
        }
        const outputEstimated = estimatedAmounts[estimatedAmounts.length - 1];
        if (outputEstimated === 0n) {
          addLog(`BubbleFi: Output estimasi 0, jalur swap tidak valid.`, "bubblefi");
          return;
        }
        const amountOutMin = outputEstimated * 997n / 1000n;
        const deadline = Math.floor(Date.now() / 1000) + 300;
        addLog(`BubbleFi: Mulai swap ${fromToken.name} ➯ ${toToken.name} dengan jumlah ${ethers.formatUnits(amountToSwap, 18)}`, "bubblefi");
        const raffleParam = {
          enter: false,
          fractionOfSwapAmount: { numerator: 0, denominator: 0 },
          raffleNftReceiver: "0x0000000000000000000000000000000000000000"
        };

        const swapTx = await bubbleFiRouter.swapExactTokensForTokens(
          amountToSwap,
          amountOutMin,
          swapPath,
          globalWallet.address,
          deadline,
          raffleParam,
          { nonce }
        );
        addLog(`BubbleFi: Tx swap dikirim: ${getShortHash(swapTx.hash)}`, "bubblefi");
        await swapTx.wait();
        const processPayload = {
          liqAddress: "0x",
          methodType: "SWAP",
          transactionHash: swapTx.hash,
          userAddress: globalWallet.address,
          userId: userId,
          usingBackpack: true
        };
        try {
          const postResponse = await axios.post("https://api.bubblefi.xyz/points/process-action", processPayload, {
            headers: {
              "Content-Type": "application/json",
              Cookie: BUBBLEFI_COOKIE,
              "origin": "https://app.bubblefi.xyz",
              "referer": "https://app.bubblefi.xyz/",
              "user-agent":  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36"
            }
          });
          const { pointsAwarded, totalPoints } = postResponse.data;
          addLog(`BubbleFi: Points Awarded: Points = ${pointsAwarded}, Total Points = ${totalPoints}`, "bubblefi");
          await updateWalletData();
          addLog(`BubbleFi: Swap ${fromToken.name} ➯ ${toToken.name} selesai.`, "bubblefi");
        } catch (postError) {
          addLog(`BubbleFi: Gagal memproses points: ${postError.message}`, "bubblefi");
        }
      }, `BubbleFi Swap ${fromToken.name} ➯ ${toToken.name}`);
      if (i < loopCount) {
        const delay = getRandomDelay();
        const minutes = Math.floor(delay / 60000);
        const seconds = Math.floor((delay % 60000) / 1000);
        addLog(`BubbleFiSwap: Cycle Ke ${i} Selesai`, "bubblefi");
        addLog(`BubbleFiSwap: Menunggu ${minutes} menit ${seconds} detik sebelum transaksi berikutnya...`, "bubblefi");
        await waitWithCancel(delay, "bubblefi");
        if (bubbleFiSwapCancelled) {
          addLog("BubbleFi: Auto swap dihentikan saat waktu tunggu.", "bubblefi");
          break;
        } 
      }
    } 
    bubbleFiSwapRunning = false;
    bubbleFiSubMenu.setItems(getBubbleFiMenuItems());
    mainMenu.setItems(getMainMenuItems());
    screen.render();
    addLog("BubbleFi: Auto swap selesai.", "bubblefi");
  });
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
  } else if (selected === "Monda Swap") {
    mainMenu.hide();
    mondaSubMenu.setItems(getMondaMenuItems());
    mondaSubMenu.show();
    setTimeout(() => {
      mondaSubMenu.focus();
      screen.render();
    }, 100)
  } else if (selected === "BubbleFi Swap") {
    mainMenu.hide();
    bubbleFiSubMenu.setItems(getBubbleFiMenuItems());
    bubbleFiSubMenu.show();
    setTimeout(() => {
      bubbleFiSubMenu.focus();
      screen.render();
    }, 100);
  }  else if (selected === "Antrian Transaksi") {
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

mondaSubMenu.on("select", (item) => {
  const selected = item.getText();
  if (selected === "Auto Swap Mon & Dak") {
    runMondaSwapMonDak();
  } else if (selected === "Auto Swap Mon & USDC/USDT") {
    runMondaSwapMonUsdcUsdt();
  } else if (selected === "Auto Swap Mon & Monda") {
    addLog("MondaSwap: Fitur Auto Swap Mon & Monda coming soon.", "monda");
    mondaSubMenu.focus();
    return;
  } else if (selected === "Stop Transaction") {
    if (mondaSwapRunning) {
      mondaSwapCancelled = true;
      addLog("MondaSwap: Perintah Stop Transaction diterima.", "monda");
    } else {
      addLog("MondaSwap: Tidak ada transaksi yang berjalan.", "monda");
    }
  } else if (selected === "Clear Transaction Logs") {
    clearTransactionLogs();
  } else if (selected === "Back To Main Menu") {
    mondaSubMenu.hide();
    mainMenu.show();
    setTimeout(() => {
      mainMenu.focus();
      screen.render();
    }, 100);
  } else if (selected === "Exit") {
    process.exit(0);
  }
});

bubbleFiSubMenu.on("select", (item) => {
    const selected = item.getText();
    if (selected === "Auto Swap Pepe & Mldk & Myk") {
      runBubbleFiAutoSwap();
    } else if (selected === "Stop Transaction") {
      if (bubbleFiSwapRunning) {
        bubbleFiSwapCancelled = true;
        addLog("BubbleFiSwap: Perintah Stop Transaction diterima.", "bubblefi");
      } else {
        addLog("BubbleFiSwap: Tidak ada transaksi yang berjalan.", "bubblefi");
      }
    } else if (selected === "Clear Transaction Logs") {
      clearTransactionLogs();
    } else if (selected === "Back To Main Menu") {
      bubbleFiSubMenu.hide();
      mainMenu.show();
      setTimeout(() => {
        mainMenu.focus();
        screen.render();
      }, 100);
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

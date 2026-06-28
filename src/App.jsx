import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';

const CONTRACT_ADDRESS = "0x9faE3285F5fC060C984DcfA0339463Ac889a461E";
const USDT_ADDRESS = "0x9e5aac1ba1a2e6aed6b32689dfcf62a509ca96f3";

const ABI = [
  "function register(address _upline) external", 
  "function buyNFT(uint256 nftId) external", 
  "function claimExpiredNFT(uint256 nftId) external",
  "function unlockAccount() external",
  "function users(address) view returns (bool isReg, address upline, uint256 directsCount, uint256 totalEarned, uint256 levelEarned, uint256 tradingEarned, uint256 dailyInvested, uint256 lastInvTime, uint256 nfsId, bool isLocked)",
  "function nfts(uint256) view returns (uint256 id, address owner, uint256 price, uint256 listedTimestamp, bool isForSale, bool isSold, bool isClaimed)",
  "function getMarketQueue() view returns (uint256[])", 
  "function basePrice() view returns (uint256)",
  "function claimTimer() view returns (uint256)", 
  "function tradingLimit() view returns (uint256)",
  "function limitMultiplier() view returns (uint256)",
  "function userNftHistory(address, uint256) view returns (uint256)"
];

const USDT_ABI = [
  "function approve(address spender, uint256 amount) external returns (bool)", 
  "function allowance(address owner, address spender) view returns (uint256)"
];

export default function App() {
  const [acc, setAcc] = useState(null);
  const [tab, setTab] = useState('Market');
  const [user, setUser] = useState({ isReg: false, earned: "0.0", levelEarned: "0.0", tradingEarned: "0.0", directs: 0, nfsId: 0, inv: "0.0", lastInvTime: 0, isLocked: false, maxLimit: "60.0" });
  const [marketItems, setMarketItems] = useState([]);
  const [historyItems, setHistoryItems] = useState([]);
  const [claimTime, setClaimTime] = useState(129600); 
  const [now, setNow] = useState(Math.floor(Date.now() / 1000));
  const [sponsor, setSponsor] = useState('');

  const resetTime = user.lastInvTime + 86400;
  const timeLeft = (resetTime > now) ? (resetTime - now) : 0;
  const displayInv = (timeLeft === 0) ? "0.0" : user.inv;

  useEffect(() => {
    const t = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (acc) {
      fetchData();
      const interval = setInterval(fetchData, 5000);
      return () => clearInterval(interval);
    }
  }, [acc]);

  const connect = async () => {
    if(!window.ethereum) return alert("MetaMask Install Karein!");
    const p = new ethers.BrowserProvider(window.ethereum);
    const a = await p.send("eth_requestAccounts", []);
    setAcc(a[0]);
  };

  const fetchData = async () => {
    try {
      const p = new ethers.BrowserProvider(window.ethereum);
      const c = new ethers.Contract(CONTRACT_ADDRESS, ABI, p);
      const u = await c.users(acc);
      const tLimit = await c.tradingLimit();
      const lMult = await c.limitMultiplier();
      setUser({ isReg: u[0], earned: ethers.formatEther(u[3]), levelEarned: ethers.formatEther(u[4]), tradingEarned: ethers.formatEther(u[5]), directs: Number(u[2]), inv: ethers.formatEther(u[6]), lastInvTime: Number(u[7]), nfsId: Number(u[8]), isLocked: u[9], maxLimit: ethers.formatEther(tLimit * lMult) });
      const q = await c.getMarketQueue();
      const mItems = [];
      for(let id of q) {
          const n = await c.nfts(id);
          if(n[4] && !n[5] && !n[6]) mItems.push({ id: Number(n[0]), price: ethers.formatEther(n[2]) });
      }
      setMarketItems(mItems);
      // Fetch history logic maintained...
    } catch(e) { console.error(e); }
  };

  const doTx = async (action, fn, args = [], usdt = 0n) => {
    try {
      const s = await (new ethers.BrowserProvider(window.ethereum)).getSigner();
      if(usdt > 0n) {
        const u = new ethers.Contract(USDT_ADDRESS, USDT_ABI, s);
        if((await u.allowance(acc, CONTRACT_ADDRESS)) < usdt) {
            (await u.approve(CONTRACT_ADDRESS, ethers.MaxUint256)).wait();
        }
      }
      const c = new ethers.Contract(CONTRACT_ADDRESS, ABI, s);
      (await c[fn](...args)).wait();
      alert("Successful!"); fetchData();
    } catch(e) { alert("Error: " + e.message); }
  };

  const formatTime = (s) => {
    if(s <= 0) return "00:00:00";
    const h = Math.floor(s / 3600).toString().padStart(2, '0');
    const m = Math.floor((s % 3600) / 60).toString().padStart(2, '0');
    const sec = (s % 60).toString().padStart(2, '0');
    return `${h}:${m}:${sec}`;
  };

  return (
    <div className="min-h-screen bg-[#0a0f1a] text-white p-4">
      <div className="max-w-md mx-auto space-y-6">
        <div className="bg-[#111827] border border-blue-500 rounded-3xl p-6 text-center">
           <p className="text-xs uppercase">Daily Limit Used</p>
           <h2 className="text-4xl font-black text-blue-400">{displayInv} <span className="text-sm">/ 20 USDT</span></h2>
           <p className="text-xs font-mono">RESET IN: {formatTime(timeLeft)}</p>
        </div>
        
        {tab === 'Market' && (
          <div className="space-y-4">
            {marketItems.map((n, i) => (
              <div key={i} className="flex justify-between bg-[#111827] p-4 rounded-2xl border border-cyan-500">
                 <p>NFT #{n.id}</p>
                 <button onClick={() => doTx('Purchase', 'buyNFT', [n.id], ethers.parseEther(n.price))} className="bg-yellow-500 px-6 py-2 rounded-xl text-black font-black">BUY</button>
              </div>
            ))}
            {marketItems.length === 0 && <button onClick={() => doTx('System', 'buyNFT', [0], ethers.parseEther("1"))} className="w-full bg-blue-600 p-4 rounded-xl">BUY FRESH NFT</button>}
          </div>
        )}
      </div>
    </div>
  );
}
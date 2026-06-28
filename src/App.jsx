import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';

const CONTRACT_ADDRESS = "0x9faE3285F5fC060C984DcfA0339463Ac889a461E";
const USDT_ADDRESS = "0x9e5aac1ba1a2e6aed6b32689dfcf62a509ca96f3";

const ABI = [
  "function register(address _upline) external", 
  "function buyNFT(uint256 nftId) external", // UPDATED: ID argument accept karega
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
  const [user, setUser] = useState({ 
    isReg: false, earned: "0.0", levelEarned: "0.0", tradingEarned: "0.0", 
    directs: 0, nfsId: 0, inv: "0.0", lastInvTime: 0, isLocked: false, maxLimit: "60.0" 
  });
  const [marketItems, setMarketItems] = useState([]);
  const [historyItems, setHistoryItems] = useState([]);
  const [claimTime, setClaimTime] = useState(129600); 
  const [now, setNow] = useState(Math.floor(Date.now() / 1000));
  const [sponsor, setSponsor] = useState('');

  // TIMER LOGIC FIX: resetTime aur timeLeft calculate karo
  const resetTime = user.lastInvTime + 86400;
  const timeLeft = (resetTime > now) ? (resetTime - now) : 0;
  // Agar timer khatam (0), toh limit 0 dikhao, warna current value
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
    try {
      const p = new ethers.BrowserProvider(window.ethereum);
      const a = await p.send("eth_requestAccounts", []);
      setAcc(a[0]);
    } catch (e) { alert(e.message); }
  };

  const fetchData = async () => {
    try {
      const p = new ethers.BrowserProvider(window.ethereum);
      const c = new ethers.Contract(CONTRACT_ADDRESS, ABI, p);
      const u = await c.users(acc);
      
      let tLimit = ethers.parseEther("20");
      let lMult = 3n;
      try {
        tLimit = await c.tradingLimit();
        lMult = await c.limitMultiplier();
      } catch(err) {}

      const calculatedMaxLimit = ethers.formatEther(tLimit * lMult);

      setUser({ 
        isReg: u[0], earned: ethers.formatEther(u[3]), levelEarned: ethers.formatEther(u[4]),
        tradingEarned: ethers.formatEther(u[5]), directs: Number(u[2]), 
        inv: ethers.formatEther(u[6]), lastInvTime: Number(u[7]),
        nfsId: Number(u[8]), isLocked: u[9], maxLimit: calculatedMaxLimit
      });
      
      const cTimer = await c.claimTimer();
      setClaimTime(Number(cTimer));

      const q = await c.getMarketQueue();
      const mItems = [];
      for(let id of q) {
          const n = await c.nfts(id);
          if(!n[5]) mItems.push({ id: Number(n[0]), price: ethers.formatEther(n[2]) });
      }
      setMarketItems(mItems);

      let hItems = [];
      let i = 0;
      while(true) {
          try {
              const hId = await c.userNftHistory(acc, i);
              const n = await c.nfts(hId);
              hItems.push({ id: Number(n[0]), price: ethers.formatEther(n[2]), listedTimestamp: Number(n[3]), isForSale: n[4], isSold: n[5], isClaimed: n[6] });
              i++;
          } catch(e) { break; } 
      }
      setHistoryItems(hItems.reverse()); 
    } catch(e) { console.error(e); }
  };

  const doTx = async (action, fn, args = [], usdt = 0n) => {
    try {
      const p = new ethers.BrowserProvider(window.ethereum);
      const s = await p.getSigner();
      if(usdt > 0n) {
        const u = new ethers.Contract(USDT_ADDRESS, USDT_ABI, s);
        const allowance = await u.allowance(acc, CONTRACT_ADDRESS);
        if(allowance < usdt) {
            const approveTx = await u.approve(CONTRACT_ADDRESS, ethers.MaxUint256);
            await approveTx.wait(); 
        }
      }
      const c = new ethers.Contract(CONTRACT_ADDRESS, ABI, s);
      const tx = await c[fn](...args);
      await tx.wait();
      alert(`${action} Successful!`); 
      fetchData();
    } catch(e) { alert(`Error: ${e.reason || e.message}`); }
  };

  const formatTime = (seconds) => {
    if(seconds <= 0) return "00:00:00";
    const h = Math.floor(seconds / 3600).toString().padStart(2, '0');
    const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${h}:${m}:${s}`;
  };

  // ... (Login Screen aur Signup Screen waisa hi rakha hai)

  return (
    <div className="min-h-screen bg-[#0a0f1a] text-white font-sans pb-20">
      <div className="max-w-md mx-auto relative pt-4 px-4">
        {/* Daily Limit Card */}
        <div className="bg-[#111827]/80 border border-blue-500/40 rounded-3xl p-6 mb-6 text-center">
           <p className="text-xs text-blue-200/70 font-bold uppercase mb-2">Daily Limit Used</p>
           <h2 className="text-4xl font-black text-blue-400">{displayInv} <span className="text-sm">/ 20 USDT</span></h2>
           <p className="text-[10px] text-gray-500 font-mono mt-2">RESET IN: {formatTime(timeLeft)}</p>
        </div>

        {/* ... (Market section) */}
        {tab === 'Market' && (
          <div className="space-y-4">
            {marketItems.map((n, i) => (
              <div key={i} className="bg-[#111827] border border-cyan-500/30 rounded-2xl p-4 flex justify-between items-center">
                 <p className="font-bold">NFT #{n.id}</p>
                 {/* FIX: n.id bheja taaki specific buy ho */}
                 <button onClick={() => doTx('Purchase', 'buyNFT', [n.id], ethers.parseEther(n.price))} className="bg-gradient-to-r from-yellow-500 to-orange-500 px-6 py-2 rounded-xl text-black font-black text-xs">BUY</button>
              </div>
            ))}
            {marketItems.length === 0 && (
                <button onClick={() => doTx('System Purchase', 'buyNFT', [0], ethers.parseEther("1"))} className="...">BUY FRESH NFT</button>
            )}
          </div>
        )}
        {/* ... (Baaki sab code waisa hi hai) */}
      </div>
    </div>
  );
}
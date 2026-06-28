import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';

const CONTRACT_ADDRESS = "0x9faE3285F5fC060C984DcfA0339463Ac889a461E";
const USDT_ADDRESS = "0x9e5aac1ba1a2e6aed6b32689dfcf62a509ca96f3";

const ABI = [
  "function register(address _upline) external", 
  "function buyNFT(uint256 nftId) external", // FIX: ABI updated to accept ID
  "function claimExpiredNFT(uint256 nftId) external",
  "function unlockAccount() external",
  "function users(address) view returns (bool isReg, address upline, uint256 directsCount, uint256 totalEarned, uint256 levelEarned, uint256 tradingEarned, uint256 dailyInvested, uint256 lastInvTime, uint256 nfsId, bool isLocked)",
  "function nfts(uint256) view returns (uint256 id, address owner, uint256 price, uint256 listedTimestamp, bool isForSale, bool isSold, bool isClaimed)",
  "function getMarketQueue() view returns (uint256[])", 
  "function tradingLimit() view returns (uint256)",
  "function limitMultiplier() view returns (uint256)",
  "function userNftHistory(address, uint256) view returns (uint256)",
  "function claimTimer() view returns (uint256)"
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
  const [now, setNow] = useState(Math.floor(Date.now() / 1000));
  const [sponsor, setSponsor] = useState('');

  useEffect(() => {
    setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000);
  }, []);

  useEffect(() => { if (acc) fetchData(); }, [acc]);

  const fetchData = async () => {
    try {
      const p = new ethers.BrowserProvider(window.ethereum);
      const c = new ethers.Contract(CONTRACT_ADDRESS, ABI, p);
      const u = await c.users(acc);
      setUser({ 
        isReg: u[0], earned: ethers.formatEther(u[3]), levelEarned: ethers.formatEther(u[4]),
        tradingEarned: ethers.formatEther(u[5]), directs: Number(u[2]), inv: ethers.formatEther(u[6]), 
        lastInvTime: Number(u[7]), nfsId: Number(u[8]), isLocked: u[9], maxLimit: "60.0" 
      });
      
      const q = await c.getMarketQueue();
      const mItems = [];
      for(let id of q) {
          const n = await c.nfts(id);
          if(n[4] && !n[5]) mItems.push({ id: Number(n[0]), price: ethers.formatEther(n[2]) });
      }
      setMarketItems(mItems);
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
      await (await c[fn](...args)).wait();
      fetchData();
      alert(action + " Successful!");
    } catch(e) { alert("Error: " + (e.reason || e.message)); }
  };

  // ... (Baaki HTML structure pehle jaisa hi rahega)
  // IMPORTANT: Market section ke button mein [n.id] pass karna:
  // <button onClick={() => doTx('Purchase', 'buyNFT', [n.id], ethers.parseEther(n.price))} ...>
import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';

const CONTRACT_ADDRESS = "0x9faE3285F5fC060C984DcfA0339463Ac889a461E";
const USDT_ADDRESS = "0x9e5aac1ba1a2e6aed6b32689dfcf62a509ca96f3";

const ABI = [
  "function register(address _upline) external", 
  "function buyNFT(uint256 nftId) external", 
  "function claimExpiredNFT(uint256 nftId) external",
  "function unlockAccount() external",
  "function users(address) view returns (bool, address, uint256, uint256, uint256, uint256, uint256, uint256, uint256, bool)",
  "function nfts(uint256) view returns (uint256, address, uint256, uint256, bool, bool, bool)",
  "function getMarketQueue() view returns (uint256[])", 
  "function claimTimer() view returns (uint256)", 
  "function userNftHistory(address, uint256) view returns (uint256)"
];

const USDT_ABI = [
  "function approve(address spender, uint256 amount) external returns (bool)", 
  "function allowance(address owner, address spender) view returns (uint256)"
];

export default function App() {
  const [acc, setAcc] = useState(null);
  const [tab, setTab] = useState('Market');
  const [user, setUser] = useState({ isReg: false, earned: "0", directs: 0, inv: "0", lastInvTime: 0, isLocked: false, nfsId: 0 });
  const [marketItems, setMarketItems] = useState([]);
  const [historyItems, setHistoryItems] = useState([]);

  useEffect(() => { if (acc) fetchData(); }, [acc]);

  const fetchData = async () => {
    try {
      const p = new ethers.BrowserProvider(window.ethereum);
      const c = new ethers.Contract(CONTRACT_ADDRESS, ABI, p);
      const u = await c.users(acc);
      setUser({ isReg: u[0], earned: ethers.formatEther(u[3]), directs: Number(u[2]), inv: ethers.formatEther(u[6]), lastInvTime: Number(u[7]), isLocked: u[9], nfsId: Number(u[8]) });
      
      const q = await c.getMarketQueue();
      const m = [];
      for(let id of q) {
          const n = await c.nfts(id);
          if(n[4] && !n[5]) m.push({ id: Number(n[0]), price: ethers.formatEther(n[2]) });
      }
      setMarketItems(m);
    } catch(e) { console.error(e); }
  };

  const doTx = async (fn, args = [], usdt = 0n) => {
    try {
      const s = await (new ethers.BrowserProvider(window.ethereum)).getSigner();
      if(usdt > 0n) {
        const u = new ethers.Contract(USDT_ADDRESS, USDT_ABI, s);
        if((await u.allowance(acc, CONTRACT_ADDRESS)) < usdt) (await u.approve(CONTRACT_ADDRESS, ethers.MaxUint256)).wait();
      }
      const c = new ethers.Contract(CONTRACT_ADDRESS, ABI, s);
      await (await c[fn](...args)).wait();
      fetchData();
      alert("Success!");
    } catch(e) { alert(e.reason || e.message); }
  };

  if (!acc) return <div className="h-screen bg-[#0a0f1a] flex items-center justify-center"><button onClick={async () => setAcc((await (new ethers.BrowserProvider(window.ethereum)).send("eth_requestAccounts", []))[0])} className="bg-blue-600 p-4 rounded-full font-black text-white">CONNECT WALLET</button></div>;

  return (
    <div className="min-h-screen bg-[#0a0f1a] text-white p-4">
      <div className="max-w-md mx-auto">
        <h1 className="text-xl font-black text-yellow-500 text-center mb-6">NFTradex</h1>
        
        {/* MARKET QUEUE */}
        <div className="space-y-4">
          {marketItems.map(n => (
            <div key={n.id} className="bg-[#111827] p-4 rounded-xl border border-cyan-500 flex justify-between">
              <p>NFT #{n.id} - {n.price} USDT</p>
              <button onClick={() => doTx('buyNFT', [n.id], ethers.parseEther(n.price))} className="bg-yellow-500 px-4 py-1 rounded text-black font-bold">BUY</button>
            </div>
          ))}
          {marketItems.length === 0 && <button onClick={() => doTx('buyNFT', [0], ethers.parseEther("1"))} className="w-full bg-blue-600 p-3 rounded-xl">BUY FRESH NFT (1 USDT)</button>}
        </div>
      </div>
    </div>
  );
}
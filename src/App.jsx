import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';

const CONTRACT_ADDRESS = "0x9faE3285F5fC060C984DcfA0339463Ac889a461E";
const USDT_ADDRESS = "0x9e5aac1ba1a2e6aed6b32689dfcf62a509ca96f3";

// ABI updated to match 10 return values of User struct + public getters
const ABI = [
  "function register(address _upline) external", 
  "function buyNFT() external", 
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
      
      // Fetch dynamic limits set by Admin
      let tLimit = ethers.parseEther("20");
      let lMult = 3n;
      try {
        tLimit = await c.tradingLimit();
        lMult = await c.limitMultiplier();
      } catch(err) { /* fallback if contract is older version */ }

      const calculatedMaxLimit = ethers.formatEther(tLimit * lMult);

      setUser({ 
        isReg: u[0], 
        earned: ethers.formatEther(u[3]), 
        levelEarned: ethers.formatEther(u[4]),
        tradingEarned: ethers.formatEther(u[5]),
        directs: Number(u[2]), 
        inv: ethers.formatEther(u[6]), 
        lastInvTime: Number(u[7]),
        nfsId: Number(u[8]), 
        isLocked: u[9],
        maxLimit: calculatedMaxLimit
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
      console.log(`[DEBUG] Action: ${action}, Amount(Wei): ${usdt.toString()}`);
      const p = new ethers.BrowserProvider(window.ethereum);
      const s = await p.getSigner();
      
      if(usdt > 0n) {
        const u = new ethers.Contract(USDT_ADDRESS, USDT_ABI, s);
        const allowance = await u.allowance(acc, CONTRACT_ADDRESS);
        
        console.log(`[DEBUG] Current Allowance: ${allowance.toString()}`);
        console.log(`[DEBUG] Contract: ${CONTRACT_ADDRESS}`);

        if(allowance < usdt) {
            alert(`Approve transaction start ho rahi hai...`);
            const approveTx = await u.approve(CONTRACT_ADDRESS, ethers.MaxUint256);
            await approveTx.wait(); 
            alert("Approve Successful! Ab Buy ke liye confirm karein.");
        }
      }
      
      alert(`Confirming ${action}...`);
      const c = new ethers.Contract(CONTRACT_ADDRESS, ABI, s);
      const tx = await c[fn](...args);
      await tx.wait();
      
      alert(`${action} Successful!`); 
      fetchData();
    } catch(e) { 
      console.error("[TX ERROR]:", e); 
      alert(`Error: ${e.reason || e.message}`); 
    }
  };

  const formatTime = (seconds) => {
    if(seconds <= 0) return "00:00:00";
    const h = Math.floor(seconds / 3600).toString().padStart(2, '0');
    const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${h}:${m}:${s}`;
  };

  if (!acc) return (
    <div className="h-screen bg-[#0a0f1a] flex flex-col items-center justify-center p-6 text-white">
      <h1 className="text-5xl font-black mb-2 text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-orange-500 tracking-wider">NFTradex</h1>
      <p className="text-gray-400 mb-10 text-sm tracking-widest">P2P TRADING PROTOCOL</p>
      <button onClick={connect} className="w-full max-w-xs bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 shadow-[0_0_20px_rgba(6,182,212,0.4)] px-8 py-4 rounded-full font-black tracking-widest transition-all">CONNECT WALLET</button>
    </div>
  );

  if (acc && !user.isReg) return (
    <div className="h-screen bg-[#0a0f1a] flex flex-col items-center justify-center p-6 text-white">
      <div className="bg-[#111827]/80 border border-cyan-500/30 p-8 rounded-3xl w-full max-w-sm shadow-[0_0_30px_rgba(6,182,212,0.1)] text-center">
        <h2 className="text-2xl font-black text-yellow-400 mb-2">Activate Account</h2>
        <p className="text-xs text-gray-400 mb-6">System Fee: <span className="text-white font-bold">1 USDT</span></p>
        <input className="w-full bg-[#0a0f1a] border border-gray-800 p-4 rounded-xl mb-4 text-center text-sm font-mono text-cyan-400 outline-none focus:border-cyan-500 transition-all" placeholder="Enter Sponsor Address" value={sponsor} onChange={(e) => setSponsor(e.target.value)} />
        <button onClick={() => doTx('Signup', 'register', [sponsor], ethers.parseEther("1"))} className="w-full bg-gradient-to-r from-green-500 to-emerald-600 shadow-[0_0_15px_rgba(16,185,129,0.3)] p-4 rounded-xl font-black text-black tracking-widest">PAY & SIGNUP</button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#0a0f1a] text-white font-sans selection:bg-cyan-500/30 pb-20">
      <div className="max-w-md mx-auto relative pt-4 px-4">
        
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-2 bg-[#111827] border border-gray-800 rounded-full px-3 py-1.5 shadow-inner">
             <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_5px_#22c55e] animate-pulse"></div>
             <span className="text-[9px] font-bold tracking-wider text-gray-300">CONNECTED</span>
          </div>
          <h1 className="text-xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-orange-500">NFTradex</h1>
          <div className="bg-cyan-950/40 border border-cyan-500/50 text-cyan-400 text-[10px] font-bold px-3 py-1.5 rounded-full flex items-center gap-1">
            <span className="text-cyan-300">⬢</span> opBNB
          </div>
        </div>

        {/* Daily Limit Card */}
        <div className="bg-[#111827]/80 border border-blue-500/40 rounded-3xl p-6 mb-6 shadow-[0_0_20px_rgba(59,130,246,0.15)] relative overflow-hidden text-center">
           <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-600 to-cyan-400"></div>
           <p className="text-xs text-blue-200/70 font-bold tracking-widest mb-2 uppercase">Daily Limit Used</p>
           <h2 className="text-4xl font-black text-blue-400 drop-shadow-[0_0_10px_rgba(96,165,250,0.5)]">{user.inv} <span className="text-xl text-yellow-500">/ 20</span> <span className="text-sm text-gray-500 font-bold">USDT</span></h2>
           <p className="text-[10px] text-gray-500 font-mono mt-2 tracking-widest">RESET IN: {user.lastInvTime > 0 ? formatTime(user.lastInvTime + 86400 - now) : "00:00:00"}</p>
        </div>

        {/* ⚠️ Account Locked Warning Banner */}
        {user.isLocked && (
          <div className="bg-gradient-to-r from-red-950/90 to-orange-950/90 border border-red-500/80 rounded-3xl p-5 mb-6 shadow-[0_0_25px_rgba(239,68,68,0.25)] text-center animate-pulse">
             <h3 className="text-red-400 font-black text-sm tracking-wider mb-1">⚠️ ACCOUNT LOCKED (3x LIMIT REACHED)</h3>
             <p className="text-[11px] text-gray-300 mb-4 leading-relaxed">Aapki earning limit cross ho chuki hai. Market trading aur Level income resume karne ke liye fee pay karein.</p>
             <button onClick={() => doTx('Unlock Account', 'unlockAccount', [], ethers.parseEther("5"))} 
                     className="w-full bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-500 hover:to-orange-500 shadow-[0_0_15px_rgba(239,68,68,0.5)] py-3 rounded-xl font-black text-white text-xs tracking-widest transition-all">
                 PAY 5 USDT TO UNLOCK ID
             </button>
          </div>
        )}

        {/* Navigation Tabs */}
        <div className="flex bg-[#111827] rounded-full p-1.5 mb-6 border border-gray-800 shadow-inner">
          {['Market', 'History', 'Income'].map(t => (
            <button key={t} onClick={() => setTab(t)} className={`flex-1 py-2.5 rounded-full text-xs font-black tracking-wider transition-all duration-300 ${tab===t ? 'bg-gradient-to-r from-blue-600 to-cyan-600 shadow-[0_0_10px_rgba(6,182,212,0.3)] text-white' : 'text-gray-500 hover:text-gray-300'}`}>{t.toUpperCase()}</button>
          ))}
        </div>
        
        {/* MARKET TAB */}
        {tab === 'Market' && (
          <div className="space-y-4 animate-in fade-in duration-300">
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2 pl-2">Live Market Queue</h3>
            {marketItems.map((n, i) => (
              <div key={i} className="bg-[#111827]/60 border border-cyan-500/30 rounded-2xl p-4 flex justify-between items-center shadow-[0_0_15px_rgba(6,182,212,0.05)] hover:border-cyan-400 transition-all group">
                 <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-black border border-cyan-500/50 rounded-xl flex items-center justify-center text-cyan-400 text-xl shadow-inner group-hover:shadow-[0_0_10px_rgba(6,182,212,0.4)]">🤖</div>
                    <div>
                       <p className="font-bold text-sm tracking-wider text-gray-200">NFT #{n.id}</p>
                       <p className="text-xs font-bold text-yellow-400 mt-0.5">{n.price} USDT</p>
                    </div>
                 </div>
                 <button onClick={() => doTx('Purchase', 'buyNFT', [], ethers.parseEther(n.price))} className="bg-gradient-to-r from-yellow-500 to-orange-500 text-black px-6 py-2 rounded-xl font-black text-xs shadow-[0_0_10px_rgba(245,158,11,0.4)] hover:scale-105 transition-transform">BUY</button>
              </div>
            ))}
            {marketItems.length === 0 && (
              <div className="text-center py-10 bg-[#111827]/60 border border-dashed border-gray-700 rounded-2xl">
                  <p className="text-gray-500 font-mono text-sm mb-6">Market Queue is Empty.</p>
                  <button onClick={() => doTx('System Purchase', 'buyNFT', [], ethers.parseEther("1"))} 
                          className="bg-gradient-to-r from-blue-600 to-cyan-600 shadow-[0_0_15px_rgba(6,182,212,0.4)] px-6 py-3 rounded-xl font-black text-white tracking-widest hover:scale-105 transition-transform">
                      BUY FRESH NFT (1 USDT)
                  </button>
              </div>
            )}
          </div>
        )}

        {/* HISTORY TAB */}
        {tab === 'History' && (
          <div className="space-y-4 animate-in fade-in duration-300">
            {user.nfsId > 0 && (
              <div className="bg-gradient-to-r from-blue-900/20 to-indigo-900/20 border border-blue-500/50 rounded-2xl p-5 shadow-[0_0_15px_rgba(59,130,246,0.15)] flex justify-between items-center">
                 <div>
                    <span className="bg-blue-500/20 text-blue-400 text-[10px] font-black px-2.5 py-1 rounded-md mb-2 inline-block tracking-widest border border-blue-500/30">LOCKER ASSET</span>
                    <h3 className="font-bold text-lg text-white">NFT #{user.nfsId}</h3>
                 </div>
                 <div className="text-right">
                    <p className="text-xs text-gray-500 font-bold mb-1">Base Value</p>
                    <p className="font-black text-yellow-400">1.00 USDT</p>
                 </div>
              </div>
            )}
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest mt-6 mb-2 pl-2">Transaction History</h3>
            {historyItems.map((n, i) => {
              const timePassed = now - n.listedTimestamp;
              const timeLeft = claimTime - timePassed;
              const canClaim = n.isForSale && !n.isClaimed && timeLeft <= 0;
              let badge = n.isSold ? <span className="text-green-400 font-black text-xs">SOLD</span> : n.isClaimed ? <span className="text-purple-400 font-black text-xs">CLAIMED</span> : <span className="bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 px-2 py-0.5 rounded text-[10px] font-black tracking-wider">IN SALE</span>;
              return (
                <div key={i} className="border border-gray-800 rounded-2xl p-4 flex flex-col transition-all">
                   <div className="flex justify-between items-start mb-3">
                      <div className="flex gap-3">
                         <div className="w-10 h-10 bg-black rounded-lg flex items-center justify-center text-lg border border-gray-800 shadow-inner">👽</div>
                         <div>
                            <p className="font-bold text-sm tracking-wider">NFT #{n.id}</p>
                            <div>{badge}</div>
                         </div>
                      </div>
                      <div className="text-right"><p className="text-yellow-400 font-bold text-sm">{n.price} USDT</p></div>
                   </div>
                   {n.isForSale && !n.isClaimed && !n.isSold && (
                      <div className="mt-2 pt-3 border-t border-gray-800/50 flex justify-between items-center">
                         <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Timer</p>
                         {canClaim ? (
                            <button onClick={() => doTx('Claim', 'claimExpiredNFT', [n.id])} className="bg-gradient-to-r from-green-500 to-emerald-500 text-black px-5 py-1.5 rounded-lg font-black text-xs shadow-[0_0_10px_rgba(16,185,129,0.4)] animate-pulse">CLAIM</button>
                         ) : (
                            <p className="text-yellow-500 font-mono font-bold">{formatTime(timeLeft)}</p>
                         )}
                      </div>
                   )}
                </div>
              )
            })}
          </div>
        )}

        {/* INCOME TAB */}
        {tab === 'Income' && (
          <div className="space-y-4 animate-in fade-in duration-300">
            <div className="bg-[#111827] border border-cyan-500/30 rounded-3xl p-6 mb-6 shadow-[0_0_30px_rgba(6,182,212,0.1)] text-center relative overflow-hidden flex flex-col items-center justify-center">
               
               {/* Spinning Circle Display */}
               <div className="relative flex items-center justify-center w-full my-4">
                   <div className="absolute w-44 h-44 rounded-full border-[6px] border-b-transparent border-l-cyan-500 border-t-blue-500 border-r-purple-500 opacity-60 animate-[spin_10s_linear_infinite]"></div>
                   <div className="relative z-10 bg-[#0a0f1a] w-32 h-32 rounded-full flex flex-col items-center justify-center shadow-[0_0_20px_rgba(0,0,0,0.8)] border border-gray-800">
                      <p className="text-[9px] text-gray-400 font-bold uppercase tracking-widest mb-1">Total Earned</p>
                      <h2 className="text-xl font-black text-white">{user.earned}</h2>
                      <p className="text-[10px] text-yellow-500 font-bold">USDT</p>
                   </div>
               </div>

               {/* Categorized Income Grid */}
               <div className="grid grid-cols-3 gap-2 mt-4 w-full pt-4 border-t border-gray-800/80">
                 <div className="text-center bg-[#0a0f1a]/60 p-2.5 rounded-2xl border border-green-500/20">
                    <p className="text-[8px] text-gray-400 font-bold uppercase tracking-wider">Level Income</p>
                    <p className="text-xs font-black text-green-400 mt-1">{user.levelEarned}</p>
                    <span className="text-[8px] text-gray-500 font-bold">USDT</span>
                 </div>
                 <div className="text-center bg-[#0a0f1a]/60 p-2.5 rounded-2xl border border-blue-500/20">
                    <p className="text-[8px] text-gray-400 font-bold uppercase tracking-wider">Trading Income</p>
                    <p className="text-xs font-black text-blue-400 mt-1">{user.tradingEarned}</p>
                    <span className="text-[8px] text-gray-500 font-bold">USDT</span>
                 </div>
                 <div className="text-center bg-[#0a0f1a]/60 p-2.5 rounded-2xl border border-yellow-500/20">
                    <p className="text-[8px] text-gray-400 font-bold uppercase tracking-wider">Income Limit</p>
                    <p className="text-xs font-black text-yellow-400 mt-1">{user.maxLimit}</p>
                    <span className="text-[8px] text-gray-500 font-bold">USDT</span>
                 </div>
               </div>

            </div>

            <div className="grid grid-cols-2 gap-4">
               <div className="bg-[#111827]/80 border border-purple-500/30 rounded-2xl p-4">
                  <p className="text-[10px] text-purple-300/70 font-bold tracking-widest mb-1 uppercase">Direct Team</p>
                  <h3 className="text-2xl font-black text-purple-400">{user.directs} <span className="text-xs text-gray-500">Users</span></h3>
               </div>
               <div className="bg-[#111827]/80 border border-green-500/30 rounded-2xl p-4">
                  <p className="text-[10px] text-green-300/70 font-bold tracking-widest mb-1 uppercase">Net Profit</p>
                  <h3 className="text-xl font-black text-green-400">3.00%</h3>
               </div>
            </div>
          </di
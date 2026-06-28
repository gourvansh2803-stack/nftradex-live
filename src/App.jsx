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
  "function userNftHistory(address, uint256) view returns (uint256)"
];

const USDT_ABI = ["function approve(address,uint256) external returns(bool)", "function allowance(address,address) view returns(uint256)"];

export default function App() {
  const [acc, setAcc] = useState(null);
  const [tab, setTab] = useState('Market');
  const [user, setUser] = useState({ isReg: false, earned: "0", levelEarned: "0", tradingEarned: "0", directs: 0, inv: "0", lastInvTime: 0, isLocked: false });
  const [marketItems, setMarketItems] = useState([]);
  const [historyItems, setHistoryItems] = useState([]);
  const [now, setNow] = useState(Math.floor(Date.now() / 1000));

  useEffect(() => {
    setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000);
    if (window.ethereum) window.ethereum.on('accountsChanged', (a) => setAcc(a[0]));
  }, []);

  const fetchData = async () => {
    const p = new ethers.BrowserProvider(window.ethereum);
    const c = new ethers.Contract(CONTRACT_ADDRESS, ABI, p);
    const u = await c.users(acc);
    setUser({ isReg: u[0], earned: ethers.formatEther(u[3]), levelEarned: ethers.formatEther(u[4]), tradingEarned: ethers.formatEther(u[5]), directs: Number(u[2]), inv: ethers.formatEther(u[6]), lastInvTime: Number(u[7]), isLocked: u[9] });
    
    const q = await c.getMarketQueue();
    const m = [];
    for (let id of q) {
      const n = await c.nfts(id);
      if (n[4] && !n[5]) m.push({ id: Number(n[0]), price: ethers.formatEther(n[2]) });
    }
    setMarketItems(m);
  };

  const doTx = async (fn, args = [], val = 0n) => {
    const s = await (new ethers.BrowserProvider(window.ethereum)).getSigner();
    if (val > 0n) {
      const u = new ethers.Contract(USDT_ADDRESS, USDT_ABI, s);
      if ((await u.allowance(acc, CONTRACT_ADDRESS)) < val) (await u.approve(CONTRACT_ADDRESS, ethers.MaxUint256)).wait();
    }
    await (await new ethers.Contract(CONTRACT_ADDRESS, ABI, s)[fn](...args)).wait();
    fetchData();
  };

  if (!acc) return <div className="h-screen bg-[#0a0f1a] flex items-center justify-center"><button onClick={async () => setAcc((await (new ethers.BrowserProvider(window.ethereum)).send("eth_requestAccounts", []))[0])} className="bg-blue-600 p-4 rounded-full font-black">CONNECT WALLET</button></div>;
  if (!user.isReg) return <div className="p-10 text-center"><input placeholder="Sponsor Address" onChange={(e) => setUser({...user, sponsor: e.target.value})} className="p-3 w-full bg-gray-800 rounded"/><button onClick={() => doTx('register', [user.sponsor], ethers.parseEther("1"))} className="mt-4 bg-green-500 p-3 w-full rounded">SIGNUP (1 USDT)</button></div>;

  return (
    <div className="min-h-screen bg-[#0a0f1a] text-white pb-20">
      <div className="max-w-md mx-auto p-4">
        {/* Daily Limit & Timer */}
        <div className="bg-gray-900 p-6 rounded-3xl border border-blue-500 text-center mb-6">
          <p className="text-xs uppercase">Daily Limit Used</p>
          <h2 className="text-3xl font-black">{user.inv} / 20 USDT</h2>
          <p className="text-xs text-yellow-500">RESET IN: {formatTime(user.lastInvTime + 86400 - now)}</p>
        </div>

        {/* Tabs */}
        <div className="flex bg-gray-800 p-1 rounded-full mb-6">
          {['Market', 'History', 'Income'].map(t => <button key={t} onClick={() => setTab(t)} className={`flex-1 py-2 rounded-full ${tab===t?'bg-blue-600':''}`}>{t}</button>)}
        </div>

        {/* Market Content */}
        {tab === 'Market' && (
          <div className="space-y-4">
            {marketItems.map(n => (
              <div key={n.id} className="flex justify-between bg-gray-900 p-4 rounded-2xl border border-cyan-500">
                <p>NFT #{n.id}</p>
                <button onClick={() => doTx('buyNFT', [n.id], ethers.parseEther(n.price))} className="bg-yellow-500 text-black px-4 py-1 rounded-lg font-bold">BUY</button>
              </div>
            ))}
          </div>
        )}
        
        {/* Income Content */}
        {tab === 'Income' && (
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-gray-900 p-4 rounded-2xl">Income: {user.earned} USDT</div>
            <div className="bg-gray-900 p-4 rounded-2xl">Directs: {user.directs}</div>
          </div>
        )}
      </div>
    </div>
  );
}

function formatTime(s) {
  if (s <= 0) return "00:00:00";
  return new Date(s * 1000).toISOString().substr(11, 8);
}
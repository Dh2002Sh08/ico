'use client';
import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { AnchorProvider } from '@project-serum/anchor';
import { WalletNotConnectedError } from '@solana/wallet-adapter-base';
import { PublicKey } from '@solana/web3.js';
import {
  initializeICO,
  getIcoStatePDA,
  getProgram,
  withdrawSol,
} from '../utils/useprogram';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { BN } from '@project-serum/anchor';
import { getMint } from '@solana/spl-token';
import { useRouter } from 'next/navigation';

interface IcoState {
  authority: PublicKey;
  tokenMint: PublicKey;
  vault: PublicKey;
  tokenPrice: BN;
  totalContributed: BN;
  startDate: BN;
  endDate: BN;
  tokenAmount: BN;
  softCap: BN;
  hardCap: BN;
}

interface TokenInfo {
  symbol: string;
  decimals: number;
}

const ICO = () => {
  const [mintInput, setMintInput] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [softCap, setsoftCap] = useState('');
  const [hardCap, sethardCap] = useState('');
  const [tokenInfo, setTokenInfo] = useState<TokenInfo | null>(null);
  const { publicKey, wallet, connected, signTransaction, signAllTransactions } = useWallet();
  const [loading, setLoading] = useState(false);
  const [icoState, setIcoState] = useState<IcoState | null>(null);
  const [tokenPrice, setTokenPrice] = useState("");
  const [icoStatus, setIcoStatus] = useState<"upcoming" | "active" | "expired" | null>(null);
  const [now, setNow] = useState<Date | null>(null);

  const { connection } = useConnection();
  const router = useRouter();

  const provider = useMemo(() => {
    if (!wallet || !publicKey || !signTransaction || !signAllTransactions) return null;
    return new AnchorProvider(
      connection,
      { publicKey, signTransaction, signAllTransactions },
      { commitment: 'processed' }
    );
  }, [wallet, publicKey, signTransaction, signAllTransactions, connection]);

  const truncateAddress = (address: string) => {
    if (!address) return '';
    return `${address.slice(0, 4)}...${address.slice(-4)}`;
  };

  const lamportsToSol = (lamports: BN) => {
    return (lamports.toNumber() / 1_000_000_000).toFixed(9);
  };

  const formatTokenAmount = (amount: BN, decimals: number) => {
    const divisor = Math.pow(10, decimals);
    return Math.floor(amount.toNumber() / divisor).toString();
  };


  const IcoInfo = useMemo(() => {
    try {
      return new PublicKey(mintInput);
    } catch {
      return null;
    }
  }, [mintInput]);

  const icoStatePDA = useMemo(() => {
    if (!IcoInfo) return null;
    return getIcoStatePDA(IcoInfo);
  }, [IcoInfo]);

  const fetchIcoState = useCallback(async () => {
    if (!provider || !IcoInfo || !icoStatePDA) return;

    try {
      const program = getProgram(provider);
      const data = await program.account.icoState.fetch(icoStatePDA) as IcoState;
      setIcoState(data);
    } catch (err) {
      console.log('Error fetching ICO state:', err);
      toast.error('ICO not initialized yet');
      setIcoState(null);
    }
  }, [provider, IcoInfo, icoStatePDA]);

  const fetchTokenInfo = useCallback(async () => {
    if (!provider || !IcoInfo) return;
    try {
      const mintInfo = await getMint(provider.connection, IcoInfo);
      // For now, we'll use a placeholder symbol. In a real app, you might want to fetch this from a token registry
      setTokenInfo({
        symbol: 'TOKEN', // You can replace this with actual token symbol lookup
        decimals: mintInfo.decimals
      });
    } catch (err) {
      console.error('Error fetching token info:', err);
      setTokenInfo(null);
    }
  }, [provider, IcoInfo]);

  useEffect(() => {
    if (IcoInfo && provider) {
      fetchIcoState();
      fetchTokenInfo();
    }
  }, [IcoInfo, provider, fetchIcoState, fetchTokenInfo]);

  const handleInitializeICO = async () => {
    if (!provider) throw new WalletNotConnectedError();

    try {
      setLoading(true);
      const tokenMint = new PublicKey(mintInput);
      const startTimestamp = Math.floor(new Date(startDate).getTime() / 1000);
      const endTimestamp = Math.floor(new Date(endDate).getTime() / 1000);

      // Get token decimals
      // const mintInfo = await getMint(provider.connection, tokenMint);
      // const tokenDecimals = mintInfo.decimals;
      const LAMPORTS_PER_SOL = 1_000_000_000;
      // Convert token amount to raw units (considering decimals)
      const softcapAmount = Number(softCap) * LAMPORTS_PER_SOL;
      const hardcapAmount = Number(hardCap) * LAMPORTS_PER_SOL;

      console.log('Soft Cap:', softcapAmount.toString());
      console.log('Hard Cap:', hardcapAmount.toString());
      // Convert sol into lamports
      const tokenPriceLamports = Number(tokenPrice) * 1_000_000_000; // Convert SOL to lamports

      const tx = await initializeICO({
        provider,
        tokenMint,
        tokenPriceLamports: tokenPriceLamports, // Price per token in lamports
        startDate: startTimestamp,
        endDate: endTimestamp,
        softCap: softcapAmount,
        hardCap: hardcapAmount,
      });
      toast.success("ICO Initialized Successfully! Transaction: " + tx);
      await fetchIcoState();

      // Redirect after success
    router.push(`/actions?mint=${mintInput}`);
    } catch (err) {
      toast.error('err' + err);
      console.error('Error initializing ICO:', err);
    } finally {
      setLoading(false);
    }
  };


  const handleWithdrawSol = async () => {
    if (!provider) throw new WalletNotConnectedError();
    if (!IcoInfo) {
      toast.error('Please enter a valid token mint address');
      return;
    }

    try {
      setLoading(true);
      const tx = await withdrawSol({
        provider,
        tokenMint: IcoInfo,
      });
      toast.success("SOL Withdrawn Successfully! Transaction: " + tx);
      await fetchIcoState();
    } catch (err) {
      toast.error('Error withdrawing SOL: ' + err);
    } finally {
      setLoading(false);
    }
  };


  useEffect(() => {
    const interval = setInterval(() => {
      const current = new Date();
      setNow(current);
      if (icoState?.startDate && icoState?.endDate) {
        const start = new Date(icoState.startDate.toNumber() * 1000);
        const end = new Date(icoState.endDate.toNumber() * 1000);

        if (current < start) {
          setIcoStatus("upcoming");
        } else if (current >= start && current <= end) {
          setIcoStatus("active");
        } else {
          setIcoStatus("expired");
        }
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [icoState]);

  const timeLeft = (() => {
    if (!now || !icoState?.startDate) return "Unknown";

    const start = new Date(icoState.startDate.toNumber() * 1000);
    const totalSeconds = Math.max(0, Math.floor((start.getTime() - now.getTime()) / 1000));

    const days = Math.floor(totalSeconds / (3600 * 24));
    const hours = Math.floor((totalSeconds % (3600 * 24)) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    return `${days > 0 ? `${days}d ` : ''}${hours > 0 ? `${hours}h ` : ''}${minutes > 0 ? `${minutes}m ` : ''}${seconds}s`;
  })();

  const endsIn = (() => {
    if (!now || !icoState?.endDate) return "Unknown";

    const end = new Date(icoState.endDate.toNumber() * 1000);
    const totalSeconds = Math.max(0, Math.floor((end.getTime() - now.getTime()) / 1000));

    const days = Math.floor(totalSeconds / (3600 * 24));
    const hours = Math.floor((totalSeconds % (3600 * 24)) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    return `${days > 0 ? `${days}d ` : ''}${hours > 0 ? `${hours}h ` : ''}${minutes > 0 ? `${minutes}m ` : ''}${seconds}s`;
  })();
  return (
    <><div className="max-w-4xl mx-auto p-6 space-y-6 bg-gradient-to-br from-gray-50 to-gray-100 min-h-screen">
      <ToastContainer position="top-right" />

      {/* Header Section */}
      <div className="flex justify-between items-center">
        <h1 className="text-4xl font-extrabold text-gray-900 tracking-tight">
          ICO Initialize
        </h1>
        {/* <WalletMultiButton /> */}
      </div>

      {/* Main Card */}
      <div className="bg-white rounded-2xl shadow-xl p-8 transition-all duration-300 hover:shadow-2xl">
        <div className="space-y-6">
          {/* Token Mint and Price Inputs */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Token Mint Address
              </label>
              <input
                type="text"
                className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all duration-200 bg-gray-50 text-gray-900 placeholder-gray-400"
                placeholder="Enter Token Mint Address"
                value={mintInput}
                onChange={(e) => setMintInput(e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Token Price (SOL)
              </label>
              <input
                type="text"
                className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all duration-200 bg-gray-50 text-gray-900 placeholder-gray-400"
                placeholder="Enter Token Price in SOL"
                value={tokenPrice}
                onChange={(e) => setTokenPrice(e.target.value)} />
            </div>
          </div>

          {connected && (
            <>
              {/* Start and End Date Inputs */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Start Date
                  </label>
                  <input
                    type="datetime-local"
                    className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all duration-200 bg-gray-50 text-gray-900"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)} />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    End Date
                  </label>
                  <input
                    type="datetime-local"
                    className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all duration-200 bg-gray-50 text-gray-900"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)} />
                </div>
              </div>

              {/* Soft and Hard Cap Inputs */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Soft Cap (SOL)
                  </label>
                  <input
                    type="number"
                    className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all duration-200 bg-gray-50 text-gray-900 placeholder-gray-400"
                    placeholder="Enter soft cap in SOL"
                    value={softCap}
                    onChange={(e) => setsoftCap(e.target.value)} />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Hard Cap (SOL)
                  </label>
                  <input
                    type="number"
                    className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all duration-200 bg-gray-50 text-gray-900 placeholder-gray-400"
                    placeholder="Enter hard cap in SOL"
                    value={hardCap}
                    onChange={(e) => sethardCap(e.target.value)} />
                </div>
              </div>

              {/* Initialize ICO Button */}
              <button
                className="w-full bg-gradient-to-r from-indigo-500 to-indigo-600 text-white px-6 py-3 rounded-lg font-semibold hover:from-indigo-600 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-md"
                onClick={handleInitializeICO}
                disabled={loading || !mintInput || !startDate || !endDate || !softCap}
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg
                      className="animate-spin h-5 w-5 text-white"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4" />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Initializing...
                  </span>
                ) : (
                  "Initialize ICO"
                )}
              </button>
            </>
          )}

          {/* ICO State Section */}
          {icoState && (
            <div className="bg-gray-50 p-6 rounded-xl border border-gray-100">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                ICO State
              </h2>
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <p className="text-sm text-gray-600">Authority</p>
                  <p className="font-medium text-gray-900 font-mono">
                    {truncateAddress(icoState.authority.toBase58())}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Total Contributed</p>
                  <p className="font-medium text-gray-900">
                    {lamportsToSol(icoState.totalContributed)} SOL
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Price Per Token</p>
                  <p className="font-medium text-gray-900">
                    {lamportsToSol(icoState.tokenPrice)} SOL
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Token Mint</p>
                  <p className="font-medium text-gray-900 font-mono">
                    {truncateAddress(icoState.tokenMint.toBase58())}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Vault</p>
                  <p className="font-medium text-gray-900 font-mono">
                    {truncateAddress(icoState.vault.toBase58())}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Start Date</p>
                  <p className="font-medium text-gray-900">
                    {new Date(icoState.startDate.toNumber() * 1000).toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">End Date</p>
                  <p className="font-medium text-gray-900">
                    {new Date(icoState.endDate.toNumber() * 1000).toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Token Amount</p>
                  <p className="font-medium text-gray-900">
                    {tokenInfo
                      ? formatTokenAmount(icoState.tokenAmount, tokenInfo.decimals)
                      : icoState.tokenAmount.toString()}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Soft Cap</p>
                  <p className="font-medium text-gray-900">
                    {lamportsToSol(icoState.softCap)} SOL
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Hard Cap</p>
                  <p className="font-medium text-gray-900">
                    {lamportsToSol(icoState.hardCap)} SOL
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* ICO Status Display */}
          {icoStatus && (
            <div
              className={`p-5 rounded-xl text-sm font-medium flex items-center gap-3 transition-all duration-300
                    ${icoStatus === "active"
                  ? "bg-green-100 text-green-800 border-l-4 border-green-500"
                  : icoStatus === "expired"
                    ? "bg-red-100 text-red-800 border-l-4 border-red-500"
                    : "bg-yellow-100 text-yellow-800 border-l-4 border-yellow-500"}`}
            >
              <div className="text-2xl">
                {icoStatus === "active" && "🚀"}
                {icoStatus === "expired" && "⏱️"}
                {icoStatus === "upcoming" && "⏳"}
              </div>
              <div>
                {icoStatus === "active" && (
                  <div>
                    <span className="font-bold">ICO is Active!</span>
                    <br />
                    🕒 Ends in: <span className="font-mono">{endsIn || "Unknown"}</span>
                  </div>
                )}
                {icoStatus === "expired" && (
                  <span className="font-bold">ICO has Expired</span>
                )}
                {icoStatus === "upcoming" && (
                  <div>
                    <span className="font-bold">ICO is Upcoming!</span>
                    <br />
                    🕒 Starts in: <span className="font-mono">{timeLeft || "Unknown"}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Admin Controls */}
          {connected && icoState && icoState.authority.equals(publicKey!) && (
            <div className="space-y-6">
              {/* Withdraw SOL Button */}
              <button
                className="w-full bg-gradient-to-r from-red-500 to-red-600 text-white px-6 py-3 rounded-lg font-semibold hover:from-red-600 hover:to-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-md"
                onClick={handleWithdrawSol}
                disabled={loading}
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg
                      className="animate-spin h-5 w-5 text-white"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4" />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Withdrawing...
                  </span>
                ) : (
                  "Withdraw SOL"
                )}
              </button>              
            </div>
          )}
        </div>
      </div>
    </div>
    </>
  );
};

export default ICO;

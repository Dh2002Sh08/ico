'use client';

import React, { useEffect, useMemo, useState, useCallback } from 'react';
// import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { AnchorProvider } from '@project-serum/anchor';
import { WalletNotConnectedError } from '@solana/wallet-adapter-base';
import { PublicKey } from '@solana/web3.js';
import {
    getIcoStatePDA,
    getProgram,
    withdrawSol,
    updateIcoStatus,
} from '../utils/useprogram';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { BN } from '@project-serum/anchor';

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

// interface TokenInfo {
//     symbol: string;
//     decimals: number;
// }

enum IcoStatusChange {
    Active = 0,
    Inactive = 1,
    Cancelled = 2,
  }

const IcoStatus = () => {
    const [mintInput, setMintInput] = useState('');
    // const [tokenInfo, setTokenInfo] = useState<TokenInfo | null>(null);
    const { publicKey, wallet, connected, signTransaction, signAllTransactions } = useWallet();
    const [loading, setLoading] = useState(false);
    const [icoState, setIcoState] = useState<IcoState | null>(null);
    const [Status, setStatus] = useState(0);
    const [icoStatus, setIcoStatus] = useState<"upcoming" | "active" | "expired" | null>(null);
    const [now, setNow] = useState<Date | null>(null);

    const { connection } = useConnection();

    const provider = useMemo(() => {
        if (!wallet || !publicKey || !signTransaction || !signAllTransactions) return null;
        return new AnchorProvider(
            connection,
            { publicKey, signTransaction, signAllTransactions },
            { commitment: 'processed' }
        );
    }, [wallet, publicKey, signTransaction, signAllTransactions, connection]);


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

    // const fetchTokenInfo = useCallback(async () => {
    //     if (!provider || !IcoInfo) return;
    //     try {
    //         const mintInfo = await getMint(provider.connection, IcoInfo);
    //         // For now, we'll use a placeholder symbol. In a real app, you might want to fetch this from a token registry
    //         setTokenInfo({
    //             symbol: 'TOKEN', // You can replace this with actual token symbol lookup
    //             decimals: mintInfo.decimals
    //         });
    //     } catch (err) {
    //         console.error('Error fetching token info:', err);
    //         setTokenInfo(null);
    //     }
    // }, [provider, IcoInfo]);

    useEffect(() => {
        if (IcoInfo && provider) {
            fetchIcoState();
            // fetchTokenInfo();
        }
    }, [IcoInfo, provider, fetchIcoState]);

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

    const handleICOstate = async () => {
        if (!provider) throw new WalletNotConnectedError();
        if (!IcoInfo) {
            toast.error('Please enter a valid token mint address');
            return;
        }

        console.log("Gettinfg satus frontend", Status);

        try {
            setLoading(true);
            const tx = await updateIcoStatus({
                provider,
                tokenMint: IcoInfo,
                status: Status,
            });
            toast.success("ICO State Updated Successfully! Transaction: " + tx);
            await fetchIcoState(); // Refresh latest state from blockchain
        } catch (err) {
            toast.error('Error updating ICO state: ' + err);
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
    const isIcoExpired = icoStatus === 'expired';

    return (
      <div className="max-w-4xl mx-auto p-6 space-y-6 bg-gradient-to-br from-gray-50 to-gray-100 min-h-screen font-sans">
        <ToastContainer position="top-right" />
  
        {/* Header Section */}
        <div className="flex justify-between items-center">
          <h1 className="text-4xl font-extrabold text-gray-900 tracking-tight drop-shadow-sm">
            ICO Status Changer
          </h1>
          {/* <WalletMultiButton /> */}
        </div>
  
        {/* Main Card */}
        <div className="bg-white rounded-2xl shadow-xl p-8 transition-all duration-300 hover:shadow-2xl">
          <div className="space-y-6">
            {/* Token Mint Input */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Token Mint Address
              </label>
              <input
                type="text"
                className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all duration-200 bg-gray-50 text-gray-900 placeholder-gray-400 focus:outline-none"
                placeholder="Enter Token Mint Address"
                value={mintInput}
                onChange={(e) => setMintInput(e.target.value)}
              />
            </div>
  
            {/* ICO Status Display */}
            {icoStatus && (
              <div
                className={`p-5 rounded-xl text-sm font-medium flex items-center gap-3 transition-all duration-300
                  ${icoStatus === 'active' ? 'bg-green-50 text-green-800 border-l-4 border-green-500' :
                    icoStatus === 'expired' ? 'bg-red-50 text-red-800 border-l-4 border-red-500' :
                    'bg-yellow-50 text-yellow-800 border-l-4 border-yellow-500'}`}
              >
                {/* Status Icon */}
                <div className="text-2xl">
                  {icoStatus === 'active' && '🚀'}
                  {icoStatus === 'expired' && '⏱️'}
                  {icoStatus === 'upcoming' && '⏳'}
                </div>
                <div>
                  {/* Active ICO */}
                  {icoStatus === 'active' && (
                    <div>
                      <span className="font-bold">ICO is Active!</span><br />
                      🕒 Ends in: <span className="font-mono">{endsIn || 'Unknown'}</span>
                    </div>
                  )}
                  {/* Expired ICO */}
                  {icoStatus === 'expired' && (
                    <span className="font-bold">ICO has Expired</span>
                  )}
                  {/* Upcoming ICO */}
                  {icoStatus === 'upcoming' && (
                    <div>
                      <span className="font-bold">ICO is Upcoming!</span><br />
                      🕒 Starts in: <span className="font-mono">{timeLeft || 'Unknown'}</span>
                    </div>
                  )}
                </div>
              </div>
            )}
  
            {/* Admin Controls (Visible when connected and authorized) */}
            {connected && icoState && icoState.authority.equals(publicKey!) && (
              <div className="space-y-6">
                {/* Withdraw SOL Button */}
                <button
                  className="w-full bg-gradient-to-r from-red-500 to-red-600 text-white px-6 py-3 rounded-lg font-semibold hover:from-red-600 hover:to-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-md focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
                  onClick={handleWithdrawSol}
                  disabled={loading}
                >
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="animate-spin h-5 w-5 text-white" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Withdrawing...
                    </span>
                  ) : (
                    'Withdraw SOL'
                  )}
                </button>
  
                {/* ICO Status Selector */}
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-gray-700">
                    Update ICO Status
                  </label>
                  <select
                    onChange={(e) => setStatus(Number(e.target.value))}
                    defaultValue=""
                    className={`w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-gray-50 text-gray-900 transition-all duration-200 focus:outline-none
                      ${isIcoExpired ? 'opacity-50 cursor-not-allowed' : ''}`}
                    disabled={isIcoExpired}
                  >
                    <option disabled value="">
                      Select ICO State
                    </option>
                    <option value={IcoStatusChange.Active}>Active</option>
                    <option value={IcoStatusChange.Inactive}>Inactive</option>
                    <option value={IcoStatusChange.Cancelled}>Cancelled</option>
                  </select>
                  {isIcoExpired && (
                    <p className="text-sm text-red-600 mt-1">
                      Status changes are disabled as the ICO has expired.
                    </p>
                  )}
                </div>
  
                {/* Status Indicators */}
                <div className="grid grid-cols-3 gap-4">
                  <div
                    className={`p-3 rounded-lg text-center text-sm font-medium transition-all duration-200
                      ${Status === 0 ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-500'}`}
                  >
                    Active
                  </div>
                  <div
                    className={`p-3 rounded-lg text-center text-sm font-medium transition-all duration-200
                      ${Status === 1 ? 'bg-yellow-100 text-yellow-800' : 'bg-gray-100 text-gray-500'}`}
                  >
                    Inactive
                  </div>
                  <div
                    className={`p-3 rounded-lg text-center text-sm font-medium transition-all duration-200
                      ${Status === 2 ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-500'}`}
                  >
                    Cancelled
                  </div>
                </div>
  
                {/* Update Status Button */}
                <button
                  className="w-full bg-gradient-to-r from-indigo-500 to-indigo-600 text-white px-6 py-3 rounded-lg font-semibold hover:from-indigo-600 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                  onClick={handleICOstate}
                  disabled={loading || isIcoExpired}
                >
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="animate-spin h-5 w-5 text-white" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Updating...
                    </span>
                  ) : (
                    'Update Status'
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
};

export default IcoStatus;

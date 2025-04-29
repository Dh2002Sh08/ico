'use client';

import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { AnchorProvider } from '@project-serum/anchor';
import { WalletNotConnectedError } from '@solana/wallet-adapter-base';
import { PublicKey } from '@solana/web3.js';
import { useSearchParams } from 'next/navigation';
import {
    contributeToICO,
    claimTokens,
    getIcoStatePDA,
    getProgram,
    withdrawSol,
    refund,
    fetchIcoStatusData,
} from '../utils/useprogram';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { BN } from '@project-serum/anchor';
import { getMint } from '@solana/spl-token';

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

const STATUS_MAP = {
    0: "Active",
    1: "Inactive",
    2: "Cancelled",
};

const Activity = () => {
    const [mintInput, setMintInput] = useState('');
    const [contributionAmount, setContributionAmount] = useState('');
    const [tokenInfo, setTokenInfo] = useState<TokenInfo | null>(null);
    const { publicKey, wallet, connected, signTransaction, signAllTransactions } = useWallet();
    const [loading, setLoading] = useState(false);
    const [icoState, setIcoState] = useState<IcoState | null>(null);
    const [icoStatus, setIcoStatus] = useState<"upcoming" | "active" | "expired" | null>(null);
    const [now, setNow] = useState<Date | null>(null);
    const [icoStatusCheck, setIcoStatusCheck] = useState<0 | 1 | 2 | null>(null);

    const { connection } = useConnection();
    const searchParams = useSearchParams()

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
        const getchIcoStatusInfo = async () => {
            if (!provider || !IcoInfo) return;
            try {
                const data = await fetchIcoStatusData(provider, IcoInfo);
                setIcoStatusCheck(data.status);
                console.log('ICO Status Data:', data);
            } catch (err) {
                console.error('Error fetching ICO status:', err);
                // toast.error('ICO not initialized yet');
            }
        };

        getchIcoStatusInfo();
    }, [provider, IcoInfo]);




    useEffect(() => {
        if (!searchParams) return
        const address = searchParams.get('mint')
        if (address) {
            setMintInput(address)
        }
    }, [searchParams])

    useEffect(() => {
        if (mintInput && IcoInfo && provider) {
            fetchIcoState()
            fetchTokenInfo()
        }
    }, [mintInput, IcoInfo, provider, fetchIcoState, fetchTokenInfo])



    const handleContribute = async () => {
        if (!provider) throw new WalletNotConnectedError();
        if (!IcoInfo) {
            toast.error('Please enter a valid token mint address');
            return;
        }
        if (!contributionAmount) {
            toast.error('Please enter a contribution amount');
            return;
        }

        try {
            setLoading(true);
            const tx = await contributeToICO({
                provider,
                tokenMint: IcoInfo,
                lamportsContributed: Number(contributionAmount) * 1_000_000_000, // Convert SOL to lamports
            });
            toast.success("Contribution Successful! Transaction: " + tx);
            await fetchIcoState();
        } catch (err) {
            toast.error('Error contributing to ICO: ' + err);
        } finally {
            setLoading(false);
        }
    };

    const handleClaim = async () => {
        if (!provider) throw new WalletNotConnectedError();
        if (!IcoInfo) {
            toast.error('Please enter a valid token mint address');
            return;
        }

        try {
            setLoading(true);
            const tx = await claimTokens({
                provider,
                tokenMint: IcoInfo,
            });
            toast.success("Tokens Claimed Successfully! Transaction: " + tx);
            await fetchIcoState();
        } catch (err) {
            toast.error('Error claiming tokens: ' + err);
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

    const handleRefund = async () => {
        if (!provider) throw new WalletNotConnectedError();
        if (!IcoInfo) {
            toast.error('Please enter a valid token mint address');
            return;
        }

        try {
            setLoading(true);
            const tx = await refund({
                provider,
                tokenMint: IcoInfo,
            });
            toast.success("Refund Successful! Transaction: " + tx);
            await fetchIcoState();
        }
        catch (err) {
            toast.error('Error refunding: ' + err);
        } finally {
            setLoading(false);
        }

    }



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
        <div className="max-w-5xl mx-auto p-8 space-y-8 bg-gray-50 min-h-screen">
            <ToastContainer position="top-right" />
    
            <div className="flex justify-between items-center">
                <h1 className="text-4xl font-extrabold text-gray-800">ICO Actions</h1>
            </div>
    
            {/* ICO Status Description */}
            <div className="bg-white rounded-xl shadow p-6 border border-blue-100">
                <h2 className="text-xl font-bold text-gray-800 mb-4">ICO Status</h2>
                <p className="text-lg text-blue-600 font-medium">
                    {icoStatus !== null ? STATUS_MAP[icoStatusCheck!] : "Loading..."}
                </p>
                <div className="mt-4 text-sm text-gray-600 space-y-1">
                    <p><strong> * Active:</strong> Can contribute.</p>
                    <p><strong> * Inactive:</strong> Cannot contribute.</p>
                    <p><strong> * Cancelled:</strong> ICO stopped, refunds enabled.</p>
                </div>
            </div>
    
            {/* ICO Info Panel */}
            <div className="bg-white rounded-2xl shadow-lg p-8 space-y-6 border border-gray-100">
                <div>
                    <label className="block text-base font-semibold text-gray-700 mb-2">
                        Token Mint Address
                    </label>
                    <input
                        type="text"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                        placeholder="Enter Token Mint Address"
                        value={mintInput}
                        onChange={(e) => setMintInput(e.target.value)}
                    />
                </div>
    
                {icoState && (
                    <div className="bg-gray-100 p-6 rounded-xl space-y-4">
                        <h2 className="text-2xl font-bold text-gray-800">ICO State</h2>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                            <ICOField label="Authority" value={truncateAddress(icoState.authority.toBase58())} />
                            <ICOField label="Total Contributed" value={`${lamportsToSol(icoState.totalContributed)} SOL`} />
                            <ICOField label="Price Per Token" value={`${lamportsToSol(icoState.tokenPrice)} SOL`} />
                            <ICOField label="Token Mint" value={truncateAddress(icoState.tokenMint.toBase58())} />
                            <ICOField label="Vault" value={truncateAddress(icoState.vault.toBase58())} />
                            <ICOField label="Start Date" value={new Date(icoState.startDate.toNumber() * 1000).toLocaleString()} />
                            <ICOField label="End Date" value={new Date(icoState.endDate.toNumber() * 1000).toLocaleString()} />
                            <ICOField label="Token Amount" value={tokenInfo ? formatTokenAmount(icoState.tokenAmount, tokenInfo.decimals) : icoState.tokenAmount.toString()} />
                            <ICOField label="Soft Cap" value={`${lamportsToSol(icoState.softCap)} SOL`} />
                            <ICOField label="Hard Cap" value={`${lamportsToSol(icoState.hardCap)} SOL`} />
                        </div>
                    </div>
                )}
    
                {/* Status Banner */}
                {icoStatus && (
                    <div className={`p-4 rounded-lg font-semibold text-sm shadow-md transition
                        ${icoStatus === "active" ? "bg-green-500 text-white" :
                            icoStatus === "expired" ? "bg-red-500 text-white" :
                                "bg-yellow-400 text-black"}`}>
                        {icoStatus === "active" && (
                            <div>
                                🚀 ICO is Active!<br />
                                🕒 Ends in: {endsIn || "Unknown"}
                            </div>
                        )}
                        {icoStatus === "expired" && "⏱️ ICO has Expired"}
                        {icoStatus === "upcoming" && (
                            <div>
                                ⏳ ICO is Upcoming!<br />
                                🕒 Starts in: {timeLeft || "Unknown"}
                            </div>
                        )}
                    </div>
                )}
    
                {/* Withdraw Button for Authority */}
                {connected && icoState && icoState.authority.equals(publicKey!) && (
                    <button
                        className="w-full bg-red-600 text-white py-3 rounded-xl shadow-md hover:bg-red-700 transition"
                        onClick={async () => {
                            if (!icoState) {
                                toast.error("ICO state is not available.");
                                return;
                            }
                            await handleWithdrawSol();
                        }}
                        disabled={loading}
                    >
                        {loading ? 'Withdrawing...' : 'Withdraw SOL'}
                    </button>
                )}
    
                {/* User Interaction Actions */}
                {connected && (
                    <div className="space-y-6">
                        <div>
                            <label className="block text-base font-semibold text-gray-700 mb-2">
                                Contribution Amount (SOL)
                            </label>
                            <input
                                type="number"
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                placeholder="Enter amount in SOL"
                                value={contributionAmount}
                                onChange={(e) => setContributionAmount(e.target.value)}
                            />
                        </div>
    
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <button
                                className="bg-green-600 text-white py-2 rounded-lg hover:bg-green-700 transition disabled:opacity-50"
                                onClick={async () => {
                                    if (!icoState || icoStatusCheck !== 0) {
                                        toast.error("ICO is not active. Cannot contribute.");
                                        return;
                                    }
                                    if (!contributionAmount || parseFloat(contributionAmount) <= 0) {
                                        toast.error("Enter a valid contribution amount.");
                                        return;
                                    }
                                    await handleContribute();
                                }}
                                disabled={loading || !contributionAmount}
                            >
                                {loading ? 'Contributing...' : 'Contribute'}
                            </button>
    
                            <button
                                className="bg-purple-600 text-white py-2 rounded-lg hover:bg-purple-700 transition disabled:opacity-50"
                                onClick={async () => {
                                    if (!icoState) {
                                        toast.error("ICO not ready for claiming.");
                                        return;
                                    }
                                    await handleClaim();
                                }}
                                disabled={loading}
                            >
                                {loading ? 'Claiming...' : 'Claim Tokens'}
                            </button>
    
                            <button
                                className="bg-yellow-600 text-white py-2 rounded-lg hover:bg-yellow-700 transition disabled:opacity-50"
                                onClick={async () => {
                                    if (icoStatusCheck !== 2) {
                                        toast.error("ICO is not cancelled. Refund not allowed.");
                                        return;
                                    }
                                    await handleRefund();
                                }}
                                disabled={loading}
                            >
                                {loading ? 'Refund in progress...' : 'Refund'}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
    

    // Helper component for repeated ICO info fields
    function ICOField({ label, value }: { label: string, value: string }) {
        return (
            <div>
                <p className="text-sm text-gray-500">{label}</p>
                <p className="text-base font-medium text-gray-800">{value}</p>
            </div>
        );
    }


};

export default Activity;

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
    fetchWhitelistData,
} from '../utils/useprogram';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { BN } from '@project-serum/anchor';
import { getMint } from '@solana/spl-token';
import IcoStatus from './icoStatus';
import WhiteList from './whiteList';

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
    const [whitelistStatus, setWhitelistStatus] = useState<boolean | null>(null);
    const [whitelistedAddresses, setWhitelistedAddresses] = useState<PublicKey[]>([]);

    const { connection } = useConnection();
    const searchParams = useSearchParams();

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

    const fetchWhitelistInfo = useCallback(async () => {
        if (!provider || !IcoInfo) return;

        try {
            const data = await fetchWhitelistData(provider, IcoInfo);
            setWhitelistStatus(data.enable);
            setWhitelistedAddresses(data.addresses);
        } catch (err) {
            console.error("Failed to fetch whitelist data", err);
            setWhitelistStatus(null);
            setWhitelistedAddresses([]);
        }
    }, [provider, IcoInfo]);

    useEffect(() => {
        if (IcoInfo) fetchWhitelistInfo();
    }, [IcoInfo, fetchWhitelistInfo]);

    // useEffect(() => {
    //     const getchIcoStatusInfo = async () => {
    //         if (!provider || !IcoInfo) return;
    //         try {
    //             const data = await fetchIcoStatusData(provider, IcoInfo);
    //             setIcoStatusCheck(data.status);
    //             console.log('ICO Status Data:', data);
    //         } catch (err) {
    //             console.error('Error fetching ICO status:', err);
    //             // toast.error('ICO not initialized yet');
    //         }
    //     };

    //     getchIcoStatusInfo();
    // }, [provider, IcoInfo]);

    const getchIcoStatusInfo = useCallback(async () => {
        if (!provider || !IcoInfo) return;
        try {
            const data = await fetchIcoStatusData(provider, IcoInfo);
            setIcoStatusCheck(data.status);
            console.log('ICO Status Data:', data);
        } catch (err) {
            console.error('Error fetching ICO status:', err);
            // toast.error('ICO not initialized yet');
        }
    }, [provider, IcoInfo]);

    useEffect(() => {
        if (IcoInfo) getchIcoStatusInfo();
    }, [IcoInfo, getchIcoStatusInfo]);


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
        <div className="max-w-5xl mx-auto px-6 py-8 space-y-6 bg-gradient-to-br from-purple-50 to-purple-100 min-h-screen">
            <ToastContainer position="top-right" />
    
            {/* ICO Details Section - Prominent and Professional */}
            {icoState && (
                <div className="bg-white rounded-3xl shadow-2xl p-8 border border-purple-100">
                    <h2 className="text-2xl font-semibold text-purple-900 mb-6">ICO Details</h2>
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
    
            {/* Notification-Style Status Section */}
            <div className="flex flex-wrap items-center gap-4">
                {/* Whitelist Status Notification */}
                <div
                    className={`flex items-center px-4 py-2 rounded-lg text-sm font-medium shadow-md transition-all duration-300 ${whitelistStatus === null
                        ? 'bg-purple-100 text-purple-800 border-l-4 border-purple-500'
                        : whitelistStatus
                            ? 'bg-green-100 text-green-800 border-l-4 border-green-500'
                            : 'bg-red-100 text-red-800 border-l-4 border-red-500'
                        }`}
                >
                    <span>
                        {whitelistStatus === null
                            ? 'Whitelist: Not Loaded'
                            : whitelistStatus
                                ? '✅ Whitelist Enabled'
                                : '❌ Whitelist Disabled'}
                    </span>
                </div>
    
                {/* ICO Status Notification */}
                {icoStatusCheck !== null && (
                    <div
                        className={`flex items-center px-4 py-2 rounded-lg text-sm font-medium shadow-md transition-all duration-300 ${icoStatusCheck === 0
                            ? 'bg-green-100 text-green-800 border-l-4 border-green-500'
                            : icoStatusCheck === 1
                                ? 'bg-yellow-100 text-yellow-800 border-l-4 border-yellow-500'
                                : 'bg-red-100 text-red-800 border-l-4 border-red-500'
                            }`}
                    >
                        <span>
                            {icoStatusCheck === 0 && "✅ ICO Active, Contribution availabe"}
                            {icoStatusCheck === 1 && "⏸️ ICO Paused, Contribution not available"}
                            {icoStatusCheck === 2 && "❌ ICO Cancelled, Refund available"}
                        </span>
                    </div>
                )}
            </div>
    
            {/* Status Banner */}
            {icoStatus && (
                <div className={`p-4 rounded-xl font-medium text-sm shadow-lg transition-all duration-300
                    ${icoStatus === "active" ? "bg-green-500 text-white" :
                        icoStatus === "expired" ? "bg-red-500 text-white" :
                            "bg-yellow-500 text-black"}`}>
                    {icoStatus === "active" && (
                        <div>
                            🚀 ICO Active<br />
                            ⏳ Ends: <span className="font-mono">{endsIn || "Unknown"}</span>
                        </div>
                    )}
                    {icoStatus === "expired" && "⏱️ ICO Expired"}
                    {icoStatus === "upcoming" && (
                        <div>
                            🕓 ICO Upcoming<br />
                            🕒 Starts: <span className="font-mono">{timeLeft || "Unknown"}</span>
                        </div>
                    )}
                </div>
            )}
    
            {/* Action Panel */}
            <div className="bg-white rounded-3xl shadow-2xl p-8 space-y-6 border border-purple-100">
                {/* Withdraw Button for Owner */}
                {connected && icoState && icoState.authority.equals(publicKey!) && (
                    <button
                        className="w-full bg-gradient-to-r from-red-600 to-red-700 text-white py-3 rounded-xl font-semibold hover:from-red-700 hover:to-red-800 transition-all duration-200 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
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
                                        strokeWidth="4"
                                    />
                                    <path
                                        className="opacity-75"
                                        fill="currentColor"
                                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                                    />
                                </svg>
                                Withdrawing...
                            </span>
                        ) : (
                            "Withdraw SOL"
                        )}
                    </button>
                )}
    
                {/* Contribution Logic with Whitelist Enforcement */}
                {connected && icoState && icoStatusCheck === 0 && icoState.totalContributed.toNumber() < icoState.hardCap.toNumber() && Date.now() / 1000 < icoState.endDate.toNumber() && (
                    (whitelistStatus === false || (whitelistStatus === true && whitelistedAddresses.some(addr => addr.equals(publicKey!)))) ? (
                        <div className="space-y-6">
                            {/* Contribution Input */}
                            <div>
                                <label className="block text-sm font-semibold text-purple-700 mb-2">
                                    Contribution Amount (SOL)
                                </label>
                                <input
                                    type="number"
                                    className="w-full px-4 py-3 border border-purple-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all duration-200 bg-purple-50 text-purple-900 placeholder-purple-400"
                                    placeholder="Enter amount in SOL"
                                    value={contributionAmount}
                                    onChange={(e) => setContributionAmount(e.target.value)}
                                />
                            </div>
    
                            {/* Contribute Button */}
                            <button
                                className="w-full bg-green-600 text-white py-3 rounded-lg font-semibold hover:bg-green-700 transition-all duration-200 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                                onClick={async () => {
                                    if (!contributionAmount || parseFloat(contributionAmount) <= 0) {
                                        toast.error("Enter a valid contribution amount.");
                                        return;
                                    }
                                    await handleContribute();
                                }}
                                disabled={loading || !contributionAmount}
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
                                                strokeWidth="4"
                                            />
                                            <path
                                                className="opacity-75"
                                                fill="currentColor"
                                                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                                            />
                                        </svg>
                                        Contributing...
                                    </span>
                                ) : (
                                    "Contribute"
                                )}
                            </button>
                        </div>
                    ) : (
                        <div className="bg-yellow-100 text-yellow-800 p-4 rounded-xl shadow-lg text-center font-medium">
                            Whitelisting is enabled. You are not whitelisted and cannot contribute.
                        </div>
                    )
                )}
    
                {/* Claim Button */}
                {(icoState &&
                    icoStatusCheck === 0 &&
                    icoState.totalContributed.toNumber() >= icoState.softCap.toNumber() &&
                    Date.now() / 1000 >= icoState.endDate.toNumber()) && (
                        <button
                            className="w-full bg-purple-600 text-white py-3 rounded-lg font-semibold hover:bg-purple-700 transition-all duration-200 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                            onClick={handleClaim}
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
                                            strokeWidth="4"
                                        />
                                        <path
                                            className="opacity-75"
                                            fill="currentColor"
                                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                                        />
                                    </svg>
                                    Claiming...
                                </span>
                            ) : (
                                "Claim Tokens"
                            )}
                        </button>
                    )}
    
                {/* Refund Button */}
                {(icoState && (
                    icoStatusCheck === 2 || // Cancelled
                    (Date.now() / 1000 >= icoState.endDate.toNumber() && icoState.totalContributed.toNumber() < icoState.softCap.toNumber())
                )) && (
                        <button
                            className="w-full bg-yellow-600 text-white py-3 rounded-lg font-semibold hover:bg-yellow-700 transition-all duration-200 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                            onClick={handleRefund}
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
                                            strokeWidth="4"
                                        />
                                        <path
                                            className="opacity-75"
                                            fill="currentColor"
                                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                                        />
                                    </svg>
                                    Refunding...
                                </span>
                            ) : (
                                "Refund"
                            )}
                        </button>
                    )}
            </div>
    
            {/* Whitelisted Addresses Display (Visible to All) */}
            {whitelistStatus && whitelistedAddresses.length > 0 && (
                <div className="bg-white rounded-2xl shadow-lg p-6">
                    <h2 className="text-lg font-semibold text-purple-900 mb-4">Whitelisted Addresses</h2>
                    <ul className="text-sm bg-purple-50 p-4 rounded-lg max-h-60 overflow-y-auto space-y-2">
                        {whitelistedAddresses.map((addr, idx) => (
                            <li key={idx} className="text-purple-800 break-all bg-white p-3 rounded shadow-sm">
                                {addr.toBase58()}
                            </li>
                        ))}
                    </ul>
                </div>
            )}
    
            {/* Show WhiteList & IcoStatus only to owner */}
            {connected && icoState && publicKey && icoState.authority.equals(publicKey) && (
                <>
                    <WhiteList
                        refreshWhitelist={fetchWhitelistInfo}
                    />
                    <IcoStatus
                        refreshIcoStatus={getchIcoStatusInfo}
                    />
                </>
            )}
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

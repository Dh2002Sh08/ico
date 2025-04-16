'use client';

import React, { useEffect, useMemo, useState, useCallback } from 'react';
// import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { AnchorProvider } from '@project-serum/anchor';
import { WalletNotConnectedError } from '@solana/wallet-adapter-base';
import { PublicKey } from '@solana/web3.js';
import { format } from "date-fns";
import {
    initializeICO,
    contributeToICO,
    claimTokens,
    getIcoStatePDA,
    getProgram,
    withdrawSol,
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
}

interface TokenInfo {
    symbol: string;
    decimals: number;
}

const ICO = () => {
    const [mintInput, setMintInput] = useState('');
    const [contributionAmount, setContributionAmount] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [tokenAmount, setTokenAmount] = useState('');
    const [tokenInfo, setTokenInfo] = useState<TokenInfo | null>(null);
    const { publicKey, wallet, connected, signTransaction, signAllTransactions } = useWallet();
    const [loading, setLoading] = useState(false);
    const [icoState, setIcoState] = useState<IcoState | null>(null);
    const [tokenPrice, setTokenPrice] = useState("");
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
            const mintInfo = await getMint(provider.connection, tokenMint);
            const tokenDecimals = mintInfo.decimals;

            // Convert token amount to raw units (considering decimals)
            const rawTokenAmount = Number(tokenAmount) * Math.pow(10, tokenDecimals);

            // Convert sol into lamports
            const tokenPriceLamports = Number(tokenPrice) * 1_000_000_000; // Convert SOL to lamports

            const tx = await initializeICO({
                provider,
                tokenMint,
                tokenPriceLamports: tokenPriceLamports, // Price per token in lamports
                startDate: startTimestamp,
                endDate: endTimestamp,
                tokenAmount: rawTokenAmount,
            });
            toast.success("ICO Initialized Successfully! Transaction: " + tx);
            await fetchIcoState();
        } catch (err) {
            toast.error('Error initializing ICO: ' + err);
        } finally {
            setLoading(false);
        }
    };

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
    useEffect(() => {
        const interval = setInterval(() => {
            const current = new Date();
            setNow(current);

            if (startDate && endDate) {
                const start = new Date(startDate);
                const end = new Date(endDate);

                if (current < start) {
                    setIcoStatus("upcoming");
                } else if (current >= start && current <= end) {
                    setIcoStatus("active");
                } else {
                    setIcoStatus("expired");
                }
            }
        }, 1000); // Update every second

        return () => clearInterval(interval);
    }, [startDate, endDate]);

    return (
        <div className="max-w-4xl mx-auto p-6 space-y-6 bg-gray-100">
            <ToastContainer position="top-right" />
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold text-gray-800">ICO Dashboard</h1>
                {/* <WalletMultiButton /> */}
            </div>

            <div className="bg-white rounded-lg shadow-md p-6">
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Token Mint Address
                        </label>
                        <input
                            type="text"
                            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                            placeholder="Enter Token Mint Address"
                            value={mintInput}
                            onChange={(e) => setMintInput(e.target.value)}
                        />
                        <input
                            type="text"
                            className='w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 mt-2'
                            placeholder="Enter Token Price in SOL"
                            value={tokenPrice}
                            onChange={(e) => setTokenPrice(e.target.value)}
                        />
                    </div>


                    {connected && (
                        <>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Start Date
                                    </label>
                                    <input
                                        type="datetime-local"
                                        className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                                        value={startDate}
                                        onChange={(e) => setStartDate(e.target.value)}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        End Date
                                    </label>
                                    <input
                                        type="datetime-local"
                                        className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                                        value={endDate}
                                        onChange={(e) => setEndDate(e.target.value)}
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Token Amount ({tokenInfo?.symbol || 'TOKEN'})
                                </label>
                                <input
                                    type="number"
                                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                                    placeholder={`Enter token amount in ${tokenInfo?.symbol || 'TOKEN'}`}
                                    value={tokenAmount}
                                    onChange={(e) => setTokenAmount(e.target.value)}
                                />
                            </div>

                            <button
                                className="w-full bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50"
                                onClick={handleInitializeICO}
                                disabled={loading || !mintInput || !startDate || !endDate || !tokenAmount}
                            >
                                {loading ? 'Initializing...' : 'Initialize ICO'}
                            </button>
                        </>
                    )}

                    {icoState && (
                        <div className="bg-gray-50 p-4 rounded-md">
                            <h2 className="text-lg font-semibold mb-3">ICO State</h2>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <p className="text-sm text-gray-600">Authority</p>
                                    <p className="font-medium">{truncateAddress(icoState.authority.toBase58())}</p>
                                </div>
                                <div>
                                    <p className="text-sm text-gray-600">Total Contributed</p>
                                    <p className="font-medium">{lamportsToSol(icoState.totalContributed)} SOL</p>
                                </div>
                                <div>
                                    <p className="text-sm text-gray-600">Price Per Token</p>
                                    <p className="font-medium">{lamportsToSol(icoState.tokenPrice)} SOL</p>
                                </div>
                                <div>
                                    <p className="text-sm text-gray-600">Token Mint</p>
                                    <p className="font-medium">{truncateAddress(icoState.tokenMint.toBase58())}</p>
                                </div>
                                <div>
                                    <p className="text-sm text-gray-600">Vault</p>
                                    <p className="font-medium">{truncateAddress(icoState.vault.toBase58())}</p>
                                </div>
                                <div>
                                    <p className="text-sm text-gray-600">Start Date</p>
                                    <p className="font-medium">{new Date(icoState.startDate.toNumber() * 1000).toLocaleString()}</p>
                                </div>
                                <div>
                                    <p className="text-sm text-gray-600">End Date</p>
                                    <p className="font-medium">{new Date(icoState.endDate.toNumber() * 1000).toLocaleString()}</p>
                                </div>
                                <div>
                                    <p className="text-sm text-gray-600">Token Amount</p>
                                    <p className="font-medium">
                                        {tokenInfo ? formatTokenAmount(icoState.tokenAmount, tokenInfo.decimals) : icoState.tokenAmount.toString()}

                                    </p>
                                </div>
                            </div>
                        </div>
                    )}
                    {icoStatus && (
                        <div className={`p-4 rounded-md text-sm font-medium mb-4
        ${icoStatus === "active" ? "bg-green-600 text-white" :
                                icoStatus === "expired" ? "bg-red-600 text-white" :
                                    "bg-yellow-500 text-black"}`}
                        >
                            {icoStatus === "active" && "🚀 ICO is Active!"}
                            {icoStatus === "expired" && "⏱️ ICO has Expired"}
                            {icoStatus === "upcoming" && (
                                <div>
                                    📅 ICO starts at: {startDate ? format(new Date(startDate), "PPpp") : "-"}<br />
                                    ⏳ Time left: {startDate && now ? (
                                        new Date(startDate).getTime() - now.getTime() > 0 ? (
                                            <span>
                                                {Math.floor((new Date(startDate).getTime() - now.getTime()) / 1000)} seconds
                                            </span>
                                        ) : "Starting soon..."
                                    ) : null}
                                </div>
                            )}
                        </div>
                    )}

                    {connected && icoState && icoState.authority.equals(publicKey!) && (
                        <button
                            className="w-full bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 disabled:opacity-50"
                            onClick={handleWithdrawSol}
                            disabled={loading}
                        >
                            {loading ? 'Withdrawing...' : 'Withdraw SOL'}
                        </button>
                    )}

                    {connected && (
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Contribution Amount (SOL)
                                </label>
                                <input
                                    type="number"
                                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                                    placeholder="Enter amount in SOL"
                                    value={contributionAmount}
                                    onChange={(e) => setContributionAmount(e.target.value)}
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <button
                                    className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 disabled:opacity-50"
                                    onClick={handleContribute}
                                    disabled={loading || !contributionAmount}
                                >
                                    {loading ? 'Contributing...' : 'Contribute'}
                                </button>

                                <button
                                    className="bg-purple-600 text-white px-4 py-2 rounded-md hover:bg-purple-700 disabled:opacity-50"
                                    onClick={handleClaim}
                                    disabled={loading}
                                >
                                    {loading ? 'Claiming...' : 'Claim Tokens'}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ICO;

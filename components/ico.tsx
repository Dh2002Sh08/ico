'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { AnchorProvider } from '@project-serum/anchor';
import { WalletNotConnectedError } from '@solana/wallet-adapter-base';
import { PublicKey } from '@solana/web3.js';
import {
    initializeICO,
    contributeToICO,
    claimTokens,
    getIcoStatePDA,
    getProgram,
} from '../utils/useprogram';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

const ICO = () => {
    const [mintInput, setMintInput] = useState('');
    const [contributionAmount, setContributionAmount] = useState('');
    const { publicKey, wallet, connected, signTransaction, signAllTransactions } = useWallet();
    const [loading, setLoading] = useState(false);
    const [icoState, setIcoState] = useState<any>(null);

    const { connection } = useConnection();

    const truncateAddress = (address: string) => {
        if (!address) return '';
        return `${address.slice(0, 4)}...${address.slice(-4)}`;
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

    const fetchIcoState = async () => {
        if (!provider || !IcoInfo || !icoStatePDA) return;
    
        try {
            const program = getProgram(provider);
            const data = await program.account.icoState.fetch(icoStatePDA);
            setIcoState(data);
        } catch (err) {
            console.log('Error fetching ICO state:', err);
            toast.error('ICO not initialized yet');
            setIcoState(null);
        }
    };

    const provider = useMemo(() => {
        if (!wallet || !publicKey || !signTransaction || !signAllTransactions) return null;
        return new AnchorProvider(
            connection,
            { publicKey, signTransaction, signAllTransactions },
            { commitment: 'processed' }
        );
    }, [wallet, publicKey, signTransaction, signAllTransactions, connection]);

    const handleInitializeICO = async () => {
        if (!provider) throw new WalletNotConnectedError();

        try {
            setLoading(true);
            const tokenMint = new PublicKey(mintInput);
            const tx = await initializeICO({
                provider,
                tokenMint,
                tokenPriceLamports: 1_000_000, // Price per token in lamports
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

    useEffect(() => {
        if (IcoInfo && provider) {
            fetchIcoState();
        }
    }, [IcoInfo, provider]);

    return (
        <div className="max-w-4xl mx-auto p-6 space-y-6">
            <ToastContainer position="top-right" />
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold text-gray-800">ICO Dashboard</h1>
                <WalletMultiButton />
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
                    </div>

                    {connected && (
                        <button
                            className="w-full bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50"
                            onClick={handleInitializeICO}
                            disabled={loading || !mintInput}
                        >
                            {loading ? 'Initializing...' : 'Initialize ICO'}
                        </button>
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
                                    <p className="font-medium">{icoState.totalContributed.toString()}</p>
                                </div>
                                <div>
                                    <p className="text-sm text-gray-600">Price Per Token</p>
                                    <p className="font-medium">{icoState.tokenPrice.toString()}</p>
                                </div>
                                <div>
                                    <p className="text-sm text-gray-600">Token Mint</p>
                                    <p className="font-medium">{truncateAddress(icoState.tokenMint.toBase58())}</p>
                                </div>
                                <div>
                                    <p className="text-sm text-gray-600">Vault</p>
                                    <p className="font-medium">{truncateAddress(icoState.vault.toBase58())}</p>
                                </div>
                            </div>
                        </div>
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

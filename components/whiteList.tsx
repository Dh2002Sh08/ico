'use client';

import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { AnchorProvider } from '@project-serum/anchor';
import { PublicKey } from '@solana/web3.js';
import {
    addToWhitelist,
    toggleWhitelist,
    fetchWhitelistData,
} from '../utils/useprogram';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

const WhiteList = () => {
    const [mintInput, setMintInput] = useState('');
    const { publicKey, wallet, signTransaction, signAllTransactions } = useWallet();
    const [loading, setLoading] = useState(false);
    const [whitelistAddress, setWhitelistAddress] = useState('');
    const [whitelistStatus, setWhitelistStatus] = useState<boolean | null>(null);
    const [whitelistedAddresses, setWhitelistedAddresses] = useState<PublicKey[]>([]);
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

    const handleWhiteList = async () => {
        if (!provider) {
            toast.dismiss(); // clears all active toasts
            return toast.error('Wallet not connected', { toastId: 'wallet', autoClose: 3000 });
        }
        if (!IcoInfo) {
            toast.dismiss();
            return toast.error('Invalid mint address', { toastId: 'invalid-mint', autoClose: 3000 });
        }
        if (!whitelistAddress) {
            toast.dismiss();
            return toast.error('Enter a wallet to whitelist', { toastId: 'empty-address', autoClose: 3000 });
        }

        try {
            setLoading(true);
            const tx = await addToWhitelist({
                provider,
                tokenMint: IcoInfo,
                walletKey: new PublicKey(whitelistAddress),
            });
            toast.success(`Whitelisted! TX: ${tx}`, {
                toastId: 'whitelist-success',
                autoClose: 5000,
            });
            toast.dismiss(); // clears all active toasts
            setWhitelistAddress('');
            await fetchWhitelistInfo(); // Refresh the list after adding
        } catch (err: any) {
            toast.error(`Error adding to whitelist: ${err.message}`, {
                toastId: 'whitelist-error',
                autoClose: 5000,
            });
            toast.dismiss(); // clears all active toasts
        } finally {
            setLoading(false);
        }
    };

    const handleToggle = async (enabled: boolean) => {
        if (!provider) {
            toast.dismiss();
            return toast.error('Wallet not connected', { toastId: 'toggle-wallet', autoClose: 3000 });
        }
        if (!IcoInfo) {
            toast.dismiss();
            return toast.error('Invalid mint address', { toastId: 'toggle-invalid-mint', autoClose: 3000 });
        }

        try {
            setLoading(true);
            const tx = await toggleWhitelist({
                provider,
                tokenMint: IcoInfo,
                enable: enabled,
            });
            toast.success(`Whitelist ${enabled ? 'enabled' : 'disabled'}! TX: ${tx}`, {
                toastId: 'toggle-error',
                autoClose: 5000,
            });
            toast.dismiss();

            await fetchWhitelistInfo(); // Refresh toggle status
        } catch (err: any) {
            toast.dismiss();

            toast.error(`Error toggling whitelist: ${err.message}`, {
                toastId: 'toggle-error',
                autoClose: 5000,
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-4xl mx-auto p-6 space-y-8 bg-gradient-to-br from-gray-50 to-gray-100 min-h-screen">
            <ToastContainer position="top-right" autoClose={5000} hideProgressBar={false}  />
            
            <h1 className="text-4xl font-extrabold text-gray-900 text-center">ICO Whitelisting</h1>

            <div className="bg-white rounded-2xl shadow-md p-6 space-y-6">
                <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Token Mint Address
                    </label>
                    <input
                        type="text"
                        className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 bg-gray-50"
                        placeholder="Enter Token Mint Address"
                        value={mintInput}
                        onChange={(e) => setMintInput(e.target.value)}
                    />
                </div>

                <div className="flex items-center justify-between mt-4">
                    <label className="text-sm font-semibold text-gray-700">
                        Enable Whitelist
                    </label>
                    <div className="flex items-center space-x-2">
                        <span className="text-sm text-gray-500">Off</span>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input
                                type="checkbox"
                                className="sr-only peer"
                                checked={!!whitelistStatus}
                                onChange={(e) => handleToggle(e.target.checked)}
                            />
                            <div className="w-11 h-6 bg-gray-200 peer-focus:ring-2 peer-focus:ring-indigo-500 rounded-full peer peer-checked:bg-indigo-600 transition duration-200" />
                            <div className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full shadow-md transform peer-checked:translate-x-5 transition-transform duration-200" />
                        </label>
                        <span className="text-sm text-gray-500">On</span>
                    </div>
                </div>

                <p className="text-sm text-gray-600 mt-2">
                    Status:{" "}
                    <span className={`font-bold ${whitelistStatus ? 'text-green-600' : 'text-red-500'}`}>
                        {whitelistStatus === null
                            ? "Not loaded"
                            : whitelistStatus
                                ? "Whitelisting is ENABLED"
                                : "Whitelisting is DISABLED"}
                    </span>
                </p>
                <p className="text-xs text-gray-500">Only the ICO initializer can toggle whitelist status.</p>
            </div>

            {whitelistStatus && (
                <div className="bg-white rounded-2xl shadow-md p-6 space-y-6">
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Wallet Address to Whitelist
                    </label>
                    <input
                        type="text"
                        className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 bg-gray-50"
                        placeholder="Enter Wallet Address"
                        value={whitelistAddress}
                        onChange={(e) => setWhitelistAddress(e.target.value)}
                    />
                    <button
                        onClick={handleWhiteList}
                        className={`w-full px-5 py-3 text-white font-semibold rounded-lg transition-all duration-200 ${loading
                                ? 'bg-gray-400'
                                : 'bg-indigo-600 hover:bg-indigo-700 focus:ring-2 focus:ring-indigo-500'
                            }`}
                        disabled={loading}
                    >
                        Whitelist Address
                    </button>
                </div>
            )}

            {whitelistedAddresses.length > 0 && (
                <div className="bg-white rounded-2xl shadow-md p-6">
                    <h2 className="text-lg font-semibold text-gray-800 mb-4">Whitelisted Addresses</h2>
                    <ul className="text-sm bg-gray-100 p-3 rounded-lg max-h-60 overflow-y-auto space-y-2">
                        {whitelistedAddresses.map((addr, idx) => (
                            <li key={idx} className="text-gray-800 break-all bg-white p-2 rounded shadow-sm">
                                {addr.toBase58()}
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
};

export default WhiteList;

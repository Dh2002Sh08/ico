'use client';

import React, { FC, useState, useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { uploadToPinata, uploadMetaData } from '../pages/api/pinata';
import { createAndMint, mplTokenMetadata, TokenStandard } from '@metaplex-foundation/mpl-token-metadata';
import { percentAmount, createSignerFromKeypair } from '@metaplex-foundation/umi';
import { createUmi } from '@metaplex-foundation/umi-bundle-defaults';
import { walletAdapterIdentity } from '@metaplex-foundation/umi-signer-wallet-adapters';
import pRetry from 'p-retry';
import { toast, ToastContainer } from 'react-toastify';

const CreateToken: FC = () => {
    const { connected, publicKey, wallet, signTransaction } = useWallet();
    const [isClient, setIsClient] = useState(false);
    const [iconFile, setIconFile] = useState<File | null>(null);
    const [tokenName, setTokenName] = useState('');
    const [tokenSymbol, setTokenSymbol] = useState('');
    const [decimals, setDecimals] = useState<number | null>(null);
    const [initialSupply, setInitialSupply] = useState('');
    const [isUploading, setIsUploading] = useState(false);
    const [newprefix, setprefix] = useState('');
    const [vanityAddress, setVanityAddress] = useState<string | null>(null);
    const [mintingInProgress, setMintingInProgress] = useState(false);
    const [transactionInfo, setTransactionInfo] = useState<{ tx: string, tokenAddress: string } | null>(null);

    useEffect(() => {
        setIsClient(true);
    }, []);

    const handleIconFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = event.target.files?.[0];
        if (selectedFile) {
            setIconFile(selectedFile);
            console.log("Selected File:", selectedFile);
        }
    };

    const handleCreateToken = async () => {
        console.log({ iconFile, tokenName, tokenSymbol, decimals, initialSupply });

        if (
            !iconFile ||
            !tokenName.trim() ||
            !tokenSymbol.trim() ||
            isNaN(Number(initialSupply)) ||
            Number(initialSupply) <= 0 ||
            decimals === null ||
            decimals === undefined
        ) {
            toast.error("Validation failed: Ensure all fields are properly filled.");
            return;
        }

        setIsUploading(true);
        setMintingInProgress(true);

        try {
            const iconUrl = await uploadToPinata(iconFile);
            console.log("Icon URL:", iconUrl);
            const metadataUrl = await uploadMetaData(tokenName, tokenSymbol, iconFile);
            console.log("Metadata URL:", metadataUrl);

            if (!publicKey || !signTransaction || !wallet) {
                throw new Error('Wallet not connected or signTransaction not available.');
            }

            const umi = createUmi('https://api.devnet.solana.com')
                .use(walletAdapterIdentity(wallet.adapter))
                .use(mplTokenMetadata());

            const prefix = newprefix;
            const response = await fetch(`../api/mint?prefix=${prefix}`);
            if (!response.ok) {
                throw new Error(`API request failed with status ${response.status}: ${await response.text()}`);
            }
            const mintData = await response.json();

            // Reconstruct the mint signer from the API response
        const mintKeypair = umi.eddsa.createKeypairFromSecretKey(new Uint8Array(mintData.secretKey));
        const mintSigner = createSignerFromKeypair(umi, mintKeypair);


            const metadata = {
                name: tokenName,
                symbol: tokenSymbol,
                uri: metadataUrl,
            };

            // Fetch vanity mint from API
            // const prefix = newprefix;
            // const response = await fetch(`/api/mint?prefix=${prefix}`);
            console.log('API Response:', response);
            if (!response.ok) {
                throw new Error(`API request failed with status ${response.status}: ${await response.text()}`);
            }

            toast.success(`Vanity Mint Address: ${mintData.publicKey.toString()}`);
            setVanityAddress(mintData.publicKey.toString());

            const adjustedAmount = Number(initialSupply) * Math.pow(10, decimals);

            const txResponse = await pRetry(
                async () => {
                    const response = await createAndMint(umi, {
                        mint: mintSigner,                          // Vanity mint signer
                        authority: umi.identity,       // Wallet as authority
                        name: metadata.name,
                        symbol: metadata.symbol,
                        uri: metadata.uri,
                        sellerFeeBasisPoints: percentAmount(0),
                        decimals: decimals,
                        amount: adjustedAmount,
                        tokenOwner: umi.identity.publicKey, // Wallet receives the tokens
                        tokenStandard: TokenStandard.Fungible,
                    }).sendAndConfirm(umi, { 
                        confirm: { commitment: 'confirmed' },
                        send: { skipPreflight: false } // Ensure preflight checks for better debugging
                    });
                    return response;
                },
                { retries: 1, minTimeout: 500 }
            );

            const transactionSignature = Buffer.from(txResponse.signature).toString('base64');
            const devnetTxUrl = `https://explorer.solana.com/tx/${transactionSignature}?cluster=devnet`;
            const devnetTokenUrl = `https://explorer.solana.com/address/${mintData.publicKey.toString()}?cluster=devnet`;

            toast.success(`Successfully minted ${metadata.name} tokens!`);
            setTransactionInfo({
                tx: devnetTxUrl,
                tokenAddress: devnetTokenUrl,
            });

        } catch (error) {
            console.error('Error creating token:', error);
        } finally {
            setIsUploading(false);
            setMintingInProgress(false);
        }
    };

    return isClient ? (
        <>
            <small className="block text-sm text-gray-700 mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg shadow-md">
                <span className="font-semibold text-red-600">NOTE:- </span>
                For fast generation of desired mint address, choose 
                <span className="font-semibold text-blue-600"> Less than 4 digits</span> and it should be
                <span className="font-semibold text-green-600"> AlphaNumeric</span>, e.g.
                <span className="font-mono text-blue-500"><b>5S</b></span> or <span className="font-mono text-blue-500"><b>D26</b></span>.
            </small>
            <div className="max-w-lg mx-auto p-6 bg-white rounded-lg shadow-md">
                <br />
                <h1 className="text-2xl font-semibold mb-6 text-center text-gray-900">Create Token</h1>

                {!connected ? (
                    <div className="flex justify-center mb-4">
                        {isClient && <WalletMultiButton />}
                    </div>
                ) : (
                    <div className="flex justify-center mb-4 space-x-2">
                        {/* <WalletMultiButton /> */}
                    </div>
                )}

                {connected && (
                    <>
                        <ToastContainer />
                        <div className="mb-4">
                            <label className="block font-medium mb-2 text-gray-700">Enter Desired Prefix:</label>
                            <input
                                type="text"
                                value={newprefix}
                                onChange={(e) => setprefix(e.target.value)}
                                placeholder="Enter desired prefix"
                                className="w-full px-4 py-2 border border-gray-300 rounded-md"
                                required
                            />
                        </div>

                        <div className="mb-4">
                            <label className="block font-medium mb-2 text-gray-700">Token Name:</label>
                            <input
                                type="text"
                                value={tokenName}
                                onChange={(e) => setTokenName(e.target.value)}
                                placeholder="Enter token name"
                                className="w-full px-4 py-2 border border-gray-300 rounded-md"
                                required
                            />
                        </div>

                        <div className="mb-4">
                            <label className="block font-medium mb-2 text-gray-700">Token Symbol:</label>
                            <input
                                type="text"
                                value={tokenSymbol}
                                onChange={(e) => setTokenSymbol(e.target.value)}
                                placeholder="Enter token symbol"
                                className="w-full px-4 py-2 border border-gray-300 rounded-md"
                                required
                            />
                        </div>

                        <div className="mb-4">
                            <label className="block font-medium mb-2 text-gray-700">Decimals:</label>
                            <input
                                type="number"
                                value={decimals ?? ''}
                                onChange={(e) => setDecimals(Number(e.target.value))}
                                placeholder="Enter decimals (e.g. 9)"
                                min="0"
                                className="w-full px-4 py-2 border border-gray-300 rounded-md"
                                required
                            />
                        </div>

                        <div className="mb-4">
                            <label className="block font-medium mb-2 text-gray-700">Upload Icon:</label>
                            <input
                                type="file"
                                onChange={handleIconFileChange}
                                className="w-full px-4 py-2 border border-gray-300 rounded-md"
                                required
                            />
                        </div>

                        <div className="mb-4">
                            <label className="block font-medium mb-2 text-gray-700">Initial Supply:</label>
                            <input
                                type="number"
                                value={initialSupply}
                                onChange={(e) => setInitialSupply(e.target.value)}
                                placeholder="Enter initial supply"
                                className="w-full px-4 py-2 border border-gray-300 rounded-md"
                                required
                            />
                        </div>

                        <div className="mb-4">
                            {vanityAddress && (
                                <div className="bg-yellow-100 text-yellow-800 p-4 rounded-md">
                                    <strong>Vanity Address Generated:</strong> {vanityAddress}
                                </div>
                            )}
                        </div>

                        {transactionInfo && (
                            <div className="w-full mb-4 bg-green-100 text-green-800 p-4 rounded-md">
                                <strong>Transaction Successful!</strong><br />
                                <span>
                                    Token Address:{' '}
                                    <a href={transactionInfo.tokenAddress} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">
                                        View on Solana Explorer
                                    </a>
                                </span>
                            </div>
                        )}

                        <div className="flex space-x-2">
                            <button
                                onClick={handleCreateToken}
                                disabled={isUploading || !connected || mintingInProgress}
                                className="w-full bg-blue-500 text-white px-4 py-2 rounded-md disabled:bg-gray-400"
                            >
                                {isUploading ? 'Uploading...' : 'Create Token'}
                            </button>
                        </div>
                    </>
                )}
            </div>
        </>
    ) : null;
};

export default CreateToken;
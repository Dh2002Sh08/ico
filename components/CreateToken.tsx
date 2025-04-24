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
          {/* Note Section */}
          <div className="max-w-2xl mx-auto mt-6 px-6">
            <small
              className="block text-sm text-gray-700 p-4 bg-yellow-50 border-l-4 border-yellow-400 rounded-lg shadow-md transition-all duration-200"
            >
              <span className="font-semibold text-red-600">NOTE: </span>
              For fast generation of desired mint address, choose
              <span className="font-semibold text-blue-600"> less than 4 digits</span> and it should be
              <span className="font-semibold text-green-600"> alphanumeric</span>, e.g.
              <span className="font-mono text-blue-500 mx-1"><b>5S</b></span> or
              <span className="font-mono text-blue-500 mx-1"><b>D26</b></span>.
            </small>
          </div>
      
          {/* Form Container */}
          <div className="max-w-2xl mx-auto p-6 bg-white rounded-2xl shadow-xl my-6 transition-all duration-300 hover:shadow-2xl">
            <h1 className="text-3xl font-extrabold text-gray-900 text-center mb-8 tracking-tight">
              Create Token
            </h1>
      
            {!connected ? (
              <div className="flex justify-center mb-6">
                {isClient && <WalletMultiButton />}
              </div>
            ) : (
              <div className="flex justify-center mb-6 space-x-2">
                {/* <WalletMultiButton /> */}
              </div>
            )}
      
            {connected && (
              <>
                <ToastContainer />
                {/* Desired Prefix */}
                <div className="mb-6">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Desired Prefix
                  </label>
                  <input
                    type="text"
                    value={newprefix}
                    onChange={(e) => setprefix(e.target.value)}
                    placeholder="Enter desired prefix (e.g., 5S)"
                    className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all duration-200 bg-gray-50 text-gray-900 placeholder-gray-400"
                    required
                  />
                </div>
      
                {/* Token Name */}
                <div className="mb-6">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Token Name
                  </label>
                  <input
                    type="text"
                    value={tokenName}
                    onChange={(e) => setTokenName(e.target.value)}
                    placeholder="Enter token name"
                    className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all duration-200 bg-gray-50 text-gray-900 placeholder-gray-400"
                    required
                  />
                </div>
      
                {/* Token Symbol */}
                <div className="mb-6">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Token Symbol
                  </label>
                  <input
                    type="text"
                    value={tokenSymbol}
                    onChange={(e) => setTokenSymbol(e.target.value)}
                    placeholder="Enter token symbol"
                    className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all duration-200 bg-gray-50 text-gray-900 placeholder-gray-400"
                    required
                  />
                </div>
      
                {/* Decimals */}
                <div className="mb-6">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Decimals
                  </label>
                  <input
                    type="number"
                    value={decimals ?? ''}
                    onChange={(e) => setDecimals(Number(e.target.value))}
                    placeholder="Enter decimals (e.g., 9)"
                    min="0"
                    className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all duration-200 bg-gray-50 text-gray-900 placeholder-gray-400"
                    required
                  />
                </div>
      
                {/* Upload Icon */}
                <div className="mb-6">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Upload Icon
                  </label>
                  <input
                    type="file"
                    onChange={handleIconFileChange}
                    className="w-full px-4 py-3 border border-gray-200 rounded-lg bg-gray-50 text-gray-900 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:bg-indigo-100 file:text-indigo-700 file:font-semibold hover:file:bg-indigo-200 transition-all duration-200"
                    required
                  />
                </div>
      
                {/* Initial Supply */}
                <div className="mb-6">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Initial Supply
                  </label>
                  <input
                    type="number"
                    value={initialSupply}
                    onChange={(e) => setInitialSupply(e.target.value)}
                    placeholder="Enter initial supply"
                    className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all duration-200 bg-gray-50 text-gray-900 placeholder-gray-400"
                    required
                  />
                </div>
      
                {/* Vanity Address Feedback */}
                {vanityAddress && (
                  <div className="mb-6 p-4 bg-yellow-50 border-l-4 border-yellow-400 rounded-lg">
                    <span className="font-semibold text-yellow-800">
                      Vanity Address Generated:
                    </span>{" "}
                    <span className="font-mono text-yellow-900">{vanityAddress}</span>
                  </div>
                )}
      
                {/* Transaction Success Feedback */}
                {transactionInfo && (
                  <div className="mb-6 p-4 bg-green-50 border-l-4 border-green-400 rounded-lg">
                    <span className="font-semibold text-green-800">
                      Transaction Successful!
                    </span>
                    <br />
                    <span>
                      Token Address:{" "}
                      <a
                        href={transactionInfo.tokenAddress}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 underline hover:text-blue-800 transition-all duration-200"
                      >
                        View on Solana Explorer
                      </a>
                    </span>
                  </div>
                )}
      
                {/* Create Token Button */}
                <div className="flex justify-center">
                  <button
                    onClick={handleCreateToken}
                    disabled={isUploading || !connected || mintingInProgress}
                    className="w-full bg-gradient-to-r from-indigo-500 to-indigo-600 text-white px-6 py-3 rounded-lg font-semibold hover:from-indigo-600 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-md"
                  >
                    {isUploading || mintingInProgress ? (
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
                        {isUploading ? "Uploading..." : "Minting..."}
                      </span>
                    ) : (
                      "Create Token"
                    )}
                  </button>
                </div>
              </>
            )}
          </div>
        </>
      ) : null;
};

export default CreateToken;
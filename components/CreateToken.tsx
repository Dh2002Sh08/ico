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
import { createSetAuthorityInstruction, AuthorityType } from '@solana/spl-token';
import { Connection, PublicKey, Transaction } from '@solana/web3.js';

const CreateToken: FC = () => {
  const { connected, publicKey, wallet, signTransaction, sendTransaction } = useWallet();
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
  const [enableMintAuthority, setEnableMintAuthority] = useState(true);
  const [enableFreezeAuthority, setEnableFreezeAuthority] = useState(true);

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

      if (!publicKey || !signTransaction || !wallet || !sendTransaction) {
        throw new Error('Wallet not connected or transaction signing not available.');
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

      toast.success(`Vanity Mint Address: ${mintData.publicKey.toString()}`);
      setVanityAddress(mintData.publicKey.toString());

      const adjustedAmount = Number(initialSupply) * Math.pow(10, decimals);

      // Create and mint the token
      const txResponse = await pRetry(
        async () => {
          const response = await createAndMint(umi, {
            mint: mintSigner,
            authority: umi.identity,
            name: metadata.name,
            symbol: metadata.symbol,
            uri: metadata.uri,
            sellerFeeBasisPoints: percentAmount(0),
            decimals: decimals,
            amount: adjustedAmount,
            tokenOwner: umi.identity.publicKey,
            tokenStandard: TokenStandard.Fungible,
          }).sendAndConfirm(umi, {
            confirm: { commitment: 'confirmed' },
            send: { skipPreflight: false },
          });
          return response;
        },
        { retries: 1, minTimeout: 500 }
      );

      const transactionSignature = Buffer.from(txResponse.signature).toString('base64');
      const devnetTxUrl = `https://explorer.solana.com/tx/${transactionSignature}?cluster=devnet`;
      const devnetTokenUrl = `https://explorer.solana.com/address/${mintData.publicKey.toString()}?cluster=devnet`;

      // Initialize Solana connection for authority updates
      const connection = new Connection('https://api.devnet.solana.com', 'confirmed');

      // Update Mint Authority if disabled
      if (!enableMintAuthority) {
        const mint = new PublicKey(mintData.publicKey);
        const currentAuthority = new PublicKey(umi.identity.publicKey);
        const instruction = createSetAuthorityInstruction(
          mint,
          currentAuthority,
          AuthorityType.MintTokens, // Updated to use MintTokens
          null // Revoke mint authority
        );

        const transaction = new Transaction().add(instruction);
        const signature = await sendTransaction(transaction, connection, {
          signers: [],
          skipPreflight: false,
        });
        await connection.confirmTransaction(signature, 'confirmed');
        console.log("Mint authority revoke tx:", signature);
        toast.success("Mint authority revoked.");
      }

      // Update Freeze Authority if disabled
      if (!enableFreezeAuthority) {
        const mint = new PublicKey(mintData.publicKey);
        const currentAuthority = new PublicKey(umi.identity.publicKey);
        const instruction = createSetAuthorityInstruction(
          mint,
          currentAuthority,
          AuthorityType.FreezeAccount, // Updated to use FreezeAccount
          null // Revoke freeze authority
        );

        const transaction = new Transaction().add(instruction);
        const signature = await sendTransaction(transaction, connection, {
          signers: [],
          skipPreflight: false,
        });
        await connection.confirmTransaction(signature, 'confirmed');
        console.log("Freeze authority revoke tx:", signature);
        toast.success("Freeze authority revoked.");
      }

      toast.success(`Successfully minted ${metadata.name} tokens!`);
      setTransactionInfo({
        tx: devnetTxUrl,
        tokenAddress: devnetTokenUrl,
      });

    } catch (error) {
      console.error('Error creating token:', error);
      toast.error(`Error: ${(error as Error).message}`);
    } finally {
      setIsUploading(false);
      setMintingInProgress(false);
    }
  };

  return isClient ? (
    <>
      {/* Animated Note Banner */}
      <div className="max-w-3xl mx-auto mt-8 px-6">
        <div className="bg-purple-100 text-gray-800 p-4 rounded-lg shadow-md hover:scale-105 transition-transform duration-300">
          <p className="text-sm font-medium">
            <span className="font-bold text-purple-600">PRO TIP:</span> For fast mint address generation, use{' '}
            <span className="font-semibold text-blue-600">less than 4 digits</span> and ensure it’s{' '}
            <span className="font-semibold text-green-600">alphanumeric</span>, e.g.{' '}
            <span className="font-mono text-blue-600 mx-1"><b>5S</b></span> or{' '}
            <span className="font-mono text-blue-600 mx-1"><b>D26</b></span>.
          </p>
        </div>
      </div>
  
      {/* Creation Hub Container */}
      <div className="max-w-3xl mx-auto my-12 p-8 bg-purple-50 rounded-2xl shadow-lg hover:shadow-xl transition-shadow duration-300">
        <h1 className="text-3xl font-bold text-center text-purple-700 mb-8">
          Create Your Token
        </h1>
  
        {!connected ? (
          <div className="flex justify-center mb-8">
            {isClient && (
              <WalletMultiButton className="bg-purple-500 text-white px-6 py-2 rounded-lg font-semibold hover:bg-purple-600 transition-colors duration-300" />
            )}
          </div>
        ) : (
          <>
            <ToastContainer theme="light" position="top-right" autoClose={5000} />
  
            {/* Desired Prefix Input */}
            <div className="mb-6">
              <label className="block text-sm font-semibold text-gray-600 mb-2">Desired Prefix</label>
              <input
                type="text"
                value={newprefix}
                onChange={(e) => setprefix(e.target.value)}
                placeholder="Enter prefix (e.g., 5S)"
                className="w-full px-4 py-3 bg-white border border-purple-200 rounded-lg text-gray-800 focus:outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-300 transition-all duration-300"
                required
                aria-label="Desired prefix"
              />
            </div>
  
            {/* Token Name Input */}
            <div className="mb-6">
              <label className="block text-sm font-semibold text-gray-600 mb-2">Token Name</label>
              <input
                type="text"
                value={tokenName}
                onChange={(e) => setTokenName(e.target.value)}
                placeholder="Name your token"
                className="w-full px-4 py-3 bg-white border border-purple-200 rounded-lg text-gray-800 focus:outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-300 transition-all duration-300"
                required
                aria-label="Token name"
              />
            </div>
  
            {/* Token Symbol Input */}
            <div className="mb-6">
              <label className="block text-sm font-semibold text-gray-600 mb-2">Token Symbol</label>
              <input
                type="text"
                value={tokenSymbol}
                onChange={(e) => setTokenSymbol(e.target.value)}
                placeholder="Choose a symbol"
                className="w-full px-4 py-3 bg-white border border-purple-200 rounded-lg text-gray-800 focus:outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-300 transition-all duration-300"
                required
                aria-label="Token symbol"
              />
            </div>
  
            {/* Decimals Input */}
            <div className="mb-6">
              <label className="block text-sm font-semibold text-gray-600 mb-2">Decimals</label>
              <input
                type="number"
                value={decimals ?? ''}
                onChange={(e) => setDecimals(Number(e.target.value))}
                placeholder="Set decimals (e.g., 9)"
                min="0"
                className="w-full px-4 py-3 bg-white border border-purple-200 rounded-lg text-gray-800 focus:outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-300 transition-all duration-300"
                required
                aria-label="Token decimals"
              />
            </div>
  
            {/* Upload Icon Input */}
            <div className="mb-6">
              <label className="block text-sm font-semibold text-gray-600 mb-2">Upload Icon</label>
              <input
                type="file"
                onChange={handleIconFileChange}
                className="w-full px-4 py-3 bg-white border border-purple-200 rounded-lg text-gray-800 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:bg-purple-100 file:text-purple-700 file:font-semibold hover:file:bg-purple-200 transition-all duration-300"
                required
                aria-label="Upload token icon"
              />
            </div>
  
            {/* Initial Supply Input */}
            <div className="mb-6">
              <label className="block text-sm font-semibold text-gray-600 mb-2">Initial Supply</label>
              <input
                type="number"
                value={initialSupply}
                onChange={(e) => setInitialSupply(e.target.value)}
                placeholder="Set initial supply"
                min="0"
                className="w-full px-4 py-3 bg-white border border-purple-200 rounded-lg text-gray-800 focus:outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-300 transition-all duration-300"
                required
                aria-label="Initial supply"
              />
            </div>
  
            {/* Mint Authority Toggle */}
            <div className="mb-6">
              <label className="block text-sm font-semibold text-gray-600 mb-2">Mint Authority</label>
              <div className="flex items-center space-x-4">
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={enableMintAuthority}
                    onChange={() => setEnableMintAuthority(!enableMintAuthority)}
                    aria-label="Toggle mint authority"
                  />
                  <div className={`w-12 h-6 rounded-full ${enableMintAuthority ? 'bg-purple-500' : 'bg-gray-300'}`}>
                    <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform duration-300 ${enableMintAuthority ? 'translate-x-6' : ''}`}></div>
                  </div>
                </label>
                <span className="text-sm text-gray-600">{enableMintAuthority ? '🌿 Unlocked' : '🔒 Locked'}</span>
              </div>
              <p className="text-xs text-purple-500 mt-1">Lock the mint to stop future token creation.</p>
            </div>
  
            {/* Freeze Authority Toggle */}
            <div className="mb-8">
              <label className="block text-sm font-semibold text-gray-600 mb-2">Freeze Authority</label>
              <div className="flex items-center space-x-4">
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={enableFreezeAuthority}
                    onChange={() => setEnableFreezeAuthority(!enableFreezeAuthority)}
                    aria-label="Toggle freeze authority"
                  />
                  <div className={`w-12 h-6 rounded-full ${enableFreezeAuthority ? 'bg-purple-500' : 'bg-gray-300'}`}>
                    <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform duration-300 ${enableFreezeAuthority ? 'translate-x-6' : ''}`}></div>
                  </div>
                </label>
                <span className="text-sm text-gray-600">{enableFreezeAuthority ? '❄️ Freezable' : '🔥 Unfreezable'}</span>
              </div>
              <p className="text-xs text-purple-500 mt-1">Disable freezing to ensure tokens are transferable.</p>
            </div>
  
            {/* Vanity Address Feedback */}
            {vanityAddress && (
              <div className="mb-6 p-4 bg-purple-100 border-l-4 border-purple-400 rounded-lg">
                <span className="font-semibold text-purple-800">Vanity Address Generated:</span>{' '}
                <span className="font-mono text-purple-900">{vanityAddress}</span>
              </div>
            )}
  
            {/* Transaction Success Feedback */}
            {transactionInfo && (
              <div className="mb-6 p-4 bg-purple-100 border-l-4 border-purple-400 rounded-lg">
                <span className="font-semibold text-purple-800">Token Created Successfully!</span>
                <br />
                <span>
                  Token Address:{' '}
                  <a
                    href={transactionInfo.tokenAddress}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-500 underline hover:text-blue-600 transition-colors duration-200"
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
                className="w-full bg-purple-500 text-white px-6 py-3 rounded-lg font-semibold hover:bg-purple-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300"
              >
                {isUploading || mintingInProgress ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-5 w-5 text-white" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8h8a8 8 0 01-16 0z" />
                    </svg>
                    {isUploading ? 'Uploading...' : 'Creating...'}
                  </span>
                ) : (
                  '🌟 Create Token'
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
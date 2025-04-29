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
import confetti from 'canvas-confetti';

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

      // Trigger confetti effect on success
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
      });

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
        <div className="relative bg-gradient-to-r from-mint-200 to-lavender-200 text-gray-800 p-4 rounded-xl shadow-lg transform hover:scale-105 transition-all duration-300 animate-pulse-subtle">
          <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-r from-mint-200/20 to-lavender-200/20 rounded-xl animate-pulse opacity-50"></div>
          <p className="relative text-sm font-medium">
            <span className="font-bold text-pink-500">PRO TIP:</span> For fast generation of your desired mint address, choose{' '}
            <span className="font-semibold text-blue-500">less than 4 digits</span> and ensure it’s{' '}
            <span className="font-semibold text-green-500">alphanumeric</span>, e.g.{' '}
            <span className="font-mono text-blue-500 mx-1"><b>5S</b></span> or{' '}
            <span className="font-mono text-blue-500 mx-1"><b>D26</b></span>.
          </p>
        </div>
      </div>

      {/* Creation Hub Container */}
      <div className="relative max-w-3xl mx-auto my-12 p-8 bg-gradient-to-br from-gray-50 to-white rounded-3xl shadow-xl overflow-hidden transform hover:shadow-[0_0_30px_rgba(167,243,208,0.4)] transition-all duration-500">
        {/* Background Bubble Effect */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute w-2 h-2 bg-mint-300 rounded-full animate-float top-12 left-16"></div>
          <div className="absolute w-3 h-3 bg-lavender-300 rounded-full animate-float top-36 right-20 delay-100"></div>
          <div className="absolute w-2 h-2 bg-babyblue-300 rounded-full animate-float bottom-20 left-28 delay-200"></div>
        </div>

        <h1 className="text-4xl font-extrabold  bg-clip-text bg-gradient-to-r from-mint-500 to-lavender-500 text-center mb-10 tracking-wider animate-glow">
          🌱 Create Your Token
        </h1>

        {!connected ? (
          <div className="flex justify-center mb-8">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-mint-400 to-lavender-400 rounded-lg blur opacity-75 animate-pulse"></div>
              {isClient && (
                <WalletMultiButton className="relative bg-gradient-to-r from-mint-500 to-lavender-500 text-white px-8 py-3 rounded-lg font-semibold hover:from-mint-600 hover:to-lavender-600 transition-all duration-300 shadow-md" />
              )}
            </div>
          </div>
        ) : (
          <div className="flex justify-center mb-8">
            {/* Optional: Uncomment to show WalletMultiButton */}
            {/* <WalletMultiButton className="bg-gradient-to-r from-mint-500 to-lavender-500 text-white px-8 py-3 rounded-lg font-semibold hover:from-mint-600 hover:to-lavender-600 transition-all duration-300 shadow-md" /> */}
          </div>
        )}

        {connected && (
          <>
            <ToastContainer theme="light" position="top-right" autoClose={5000} />
            {/* Desired Prefix Input */}
            <div className="mb-8 relative group">
              <label className="block text-sm font-bold text-gray-600 mb-3 tracking-wide">
                Desired Prefix
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={newprefix}
                  onChange={(e) => setprefix(e.target.value)}
                  placeholder="Enter prefix (e.g., 5S)"
                  className="w-full px-5 py-4 bg-white border-2 border-mint-300/50 rounded-xl text-gray-800 placeholder-mint-400/50 focus:outline-none focus:border-mint-400 focus:ring-4 focus:ring-mint-300/30 transition-all duration-300 hover:bg-gray-50 group-hover:shadow-[0_0_20px_rgba(167,243,208,0.3)]"
                  required
                  aria-label="Desired prefix"
                />
                {/* <span className="absolute left-4 top-1/2 transform -translate-y-1/2 text-mint-400 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                  
                </span> */}
              </div>
            </div>

            {/* Token Name Input */}
            <div className="mb-8 relative group">
              <label className="block text-sm font-bold text-gray-600 mb-3 tracking-wide">
                Token Name
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={tokenName}
                  onChange={(e) => setTokenName(e.target.value)}
                  placeholder="Name your token"
                  className="w-full px-5 py-4 bg-white border-2 border-lavender-300/50 rounded-xl text-gray-800 placeholder-lavender-400/50 focus:outline-none focus:border-lavender-400 focus:ring-4 focus:ring-lavender-300/30 transition-all duration-300 hover:bg-gray-50 group-hover:shadow-[0_0_20px_rgba(221,214,254,0.3)]"
                  required
                  aria-label="Token name"
                />
                {/* <span className="absolute left-4 top-1/2 transform -translate-y-1/2 text-lavender-400 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                  📛
                </span> */}
              </div>
            </div>

            {/* Token Symbol Input */}
            <div className="mb-8 relative group">
              <label className="block text-sm font-bold text-gray-600 mb-3 tracking-wide">
                Token Symbol
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={tokenSymbol}
                  onChange={(e) => setTokenSymbol(e.target.value)}
                  placeholder="Choose a symbol"
                  className="w-full px-5 py-4 bg-white border-2 border-babyblue-300/50 rounded-xl text-gray-800 placeholder-babyblue-400/50 focus:outline-none focus:border-babyblue-400 focus:ring-4 focus:ring-babyblue-300/30 transition-all duration-300 hover:bg-gray-50 group-hover:shadow-[0_0_20px_rgba(186,230,253,0.3)]"
                  required
                  aria-label="Token symbol"
                />
                {/* <span className="absolute left-4 top-1/2 transform -translate-y-1/2 text-babyblue-400 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                  🔣
                </span> */}
              </div>
            </div>

            {/* Decimals Input */}
            <div className="mb-8 relative group">
              <label className="block text-sm font-bold text-gray-600 mb-3 tracking-wide">
                Decimals
              </label>
              <div className="relative">
                <input
                  type="number"
                  value={decimals ?? ''}
                  onChange={(e) => setDecimals(Number(e.target.value))}
                  placeholder="Set decimals (e.g., 9)"
                  min="0"
                  className="w-full px-5 py-4 bg-white border-2 border-pink-300/50 rounded-xl text-gray-800 placeholder-pink-400/50 focus:outline-none focus:border-pink-400 focus:ring-4 focus:ring-pink-300/30 transition-all duration-300 hover:bg-gray-50 group-hover:shadow-[0_0_20px_rgba(251,207,232,0.3)]"
                  required
                  aria-label="Token decimals"
                />
                {/* <span className="absolute left-4 top-1/2 transform -translate-y-1/2 text-pink-400 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                  ⚙️
                </span> */}
              </div>
            </div>

            {/* Upload Icon Input */}
            <div className="mb-8 relative group">
              <label className="block text-sm font-bold text-gray-600 mb-3 tracking-wide">
                Upload Icon
              </label>
              <div className="relative">
                <input
                  type="file"
                  onChange={handleIconFileChange}
                  className="w-full px-5 py-4 bg-white border-2 border-mint-300/50 rounded-xl text-gray-800 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:bg-mint-100 file:text-mint-700 file:font-semibold hover:file:bg-mint-200 transition-all duration-300 group-hover:shadow-[0_0_20px_rgba(167,243,208,0.3)]"
                  required
                  aria-label="Upload token icon"
                />
                {/* <span className="absolute left-4 top-1/2 transform -translate-y-1/2 text-mint-400 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                  🖼️
                </span> */}
              </div>
            </div>

            {/* Initial Supply Input */}
            <div className="mb-8 relative group">
              <label className="block text-sm font-bold text-gray-600 mb-3 tracking-wide">
                Initial Supply
              </label>
              <div className="relative">
                <input
                  type="number"
                  value={initialSupply}
                  onChange={(e) => setInitialSupply(e.target.value)}
                  placeholder="Set initial supply"
                  min="0"
                  className="w-full px-5 py-4 bg-white border-2 border-lavender-300/50 rounded-xl text-gray-800 placeholder-lavender-400/50 focus:outline-none focus:border-lavender-400 focus:ring-4 focus:ring-lavender-300/30 transition-all duration-300 hover:bg-gray-50 group-hover:shadow-[0_0_20px_rgba(221,214,254,0.3)]"
                  required
                  aria-label="Initial supply"
                />
                {/* <span className="absolute left-4 top-1/2 transform -translate-y-1/2 text-lavender-400 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                  💰
                </span> */}
              </div>
            </div>

            {/* Mint Authority Toggle */}
            <div className="mb-8">
              <label className="block text-sm font-bold text-gray-600 mb-3 tracking-wide">
                Mint Authority
              </label>
              <div className="flex items-center space-x-4">
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={enableMintAuthority}
                    onChange={() => setEnableMintAuthority(!enableMintAuthority)}
                    aria-label="Toggle mint authority"
                  />
                  <div className={`w-16 h-8 rounded-full transition-all duration-300 ${enableMintAuthority ? 'bg-gradient-to-r from-mint-400 to-lavender-400' : 'bg-gray-300'}`}>
                    <div
                      className={`absolute top-1 left-1 w-6 h-6 bg-white rounded-full shadow-md transform transition-all duration-300 ${enableMintAuthority ? 'translate-x-8' : ''}`}
                    ></div>
                  </div>
                </label>
                <span className="text-sm text-gray-600">
                  {enableMintAuthority ? '🌿 Unlocked' : '🔒 Locked'}
                </span>
              </div>
              <p className="text-xs text-mint-500 mt-2">
                Lock the mint to stop all future token creation. Choose wisely!
              </p>
            </div>

            {/* Freeze Authority Toggle */}
            <div className="mb-10">
              <label className="block text-sm font-bold text-gray-600 mb-3 tracking-wide">
                Freeze Authority
              </label>
              <div className="flex items-center space-x-4">
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={enableFreezeAuthority}
                    onChange={() => setEnableFreezeAuthority(!enableFreezeAuthority)}
                    aria-label="Toggle freeze authority"
                  />
                  <div className={`w-16 h-8 rounded-full transition-all duration-300 ${enableFreezeAuthority ? 'bg-gradient-to-r from-babyblue-400 to-pink-400' : 'bg-gray-300'}`}>
                    <div
                      className={`absolute top-1 left-1 w-6 h-6 bg-white rounded-full shadow-md transform transition-all duration-300 ${enableFreezeAuthority ? 'translate-x-8' : ''}`}
                    ></div>
                  </div>
                </label>
                <span className="text-sm text-gray-600">
                  {enableFreezeAuthority ? '❄️ Freezable' : '🔥 Unfreezable'}
                </span>
              </div>
              <p className="text-xs text-babyblue-500 mt-2">
                Disable freezing to ensure tokens are always transferable.
              </p>
            </div>

            {/* Vanity Address Feedback */}
            {vanityAddress && (
              <div className="mb-8 p-4 bg-mint-50 border-l-4 border-mint-400 rounded-xl shadow-md animate-pulse-subtle">
                <span className="font-semibold text-mint-800">
                  Vanity Address Generated:
                </span>{' '}
                <span className="font-mono text-mint-900">{vanityAddress}</span>
              </div>
            )}

            {/* Transaction Success Feedback */}
            {transactionInfo && (
              <div className="mb-8 p-4 bg-lavender-50 border-l-4 border-lavender-400 rounded-xl shadow-md animate-pulse-subtle">
                <span className="font-semibold text-lavender-800">
                  Token Created Successfully!
                </span>
                <br />
                <span>
                  Token Address:{' '}
                  <a
                    href={transactionInfo.tokenAddress}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-500 underline hover:text-blue-600 transition-all duration-200"
                  >
                    View on Solana Explorer
                  </a>
                </span>
              </div>
            )}

            {/* Create Token Button */}
           {/* Create Token Button */}
           <div className="flex justify-center">
              <button
                onClick={handleCreateToken}
                disabled={isUploading || !connected || mintingInProgress}
                className="relative w-full bg-gradient-to-r from-mint-500 to-lavender-500 text-black px-8 py-4 rounded-2xl font-bold text-lg cursor-pointer hover:from-mint-600 hover:to-lavender-600 hover:scale-105 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-300 shadow-lg group overflow-hidden"
              >
                <span className="absolute inset-0 bg-gradient-to-r from-mint-400 to-lavender-400 opacity-0 group-hover:opacity-20 transition-opacity duration-300"></span>
                <span className="relative flex items-center justify-center gap-3">
                  {isUploading || mintingInProgress ? (
                    <>
                      <span className="relative flex h-6 w-6">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-mint-300 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-6 w-6 bg-lavender-300"></span>
                      </span>
                      <span className="font-bold">
                        {isUploading ? 'Uploading... ✨' : 'Creating... ✨'}
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="animate-pulse">🌟 Create Token</span>
                    </>
                  )}
                </span>
              </button>
            </div>
          </>
        )}
      </div>

      CSS for Animations
      <style jsx global>{`
        @keyframes float {
          0% {
            transform: translateY(0);
            opacity: 0.8;
          }
          50% {
            transform: translateY(-20px);
            opacity: 0.4;
          }
          100% {
            transform: translateY(0);
            opacity: 0.8;
          }
        }
        @keyframes glow {
          0% {
            text-shadow: 0 0 10px rgba(20, 207, 120, 0.5);
          }
          50% {
            text-shadow: 0 0 20px rgba(167, 243, 208, 0.8);
          }
          100% {
            text-shadow: 0 0 10px rgba(167, 243, 208, 0.5);
          }
        }
        @keyframes pulse-subtle {
          0% {
            transform: scale(1);
            opacity: 0.9;
          }
          50% {
            transform: scale(1.02);
            opacity: 1;
          }
          100% {
            transform: scale(1);
            opacity: 0.9;
          }
        }
        .animate-float {
          animation: float 6s infinite ease-in-out;
        }
        .animate-glow {
          animation: glow 3s infinite ease-in-out;
        }
        .animate-pulse-subtle {
          animation: pulse-subtle 2s infinite ease-in-out;
        }
        .delay-100 {
          animation-delay: 1s;
        }
        .delay-200 {
          animation-delay: 2s;
        }
      `}</style>
    </>
  ) : null;
};

export default CreateToken;
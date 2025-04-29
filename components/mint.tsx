'use client';

import React, { FC, useState, useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { toast, ToastContainer } from 'react-toastify';
import {
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  getMint,
  createMintToInstruction,
  createSetAuthorityInstruction,
  AuthorityType,
} from '@solana/spl-token';
import { Connection, PublicKey, Transaction } from '@solana/web3.js';
import confetti from 'canvas-confetti';

const MintToken: FC = () => {
  const { connected, publicKey, wallet, sendTransaction } = useWallet();
  const [isClient, setIsClient] = useState(false);
  const [mintAddress, setMintAddress] = useState('');
  const [amount, setAmount] = useState('');
  const [isMinting, setIsMinting] = useState(false);
  const [decimals, setDecimals] = useState<number | null>(null);
  const [enableMintAuthority, setEnableMintAuthority] = useState(true);
  const [enableFreezeAuthority, setEnableFreezeAuthority] = useState(true);

  useEffect(() => {
    setIsClient(true);
  }, []);

  const handleMintToken = async () => {
    if (!mintAddress.trim() || isNaN(Number(amount)) || Number(amount) <= 0 || decimals === null) {
      toast.error('Validation failed: Ensure all fields are properly filled.');
      return;
    }

    if (!publicKey || !wallet || !sendTransaction) {
      toast.error('Wallet not connected or transaction signing not available.');
      return;
    }

    setIsMinting(true);

    try {
      const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
      const mintPublicKey = new PublicKey(mintAddress);

      // Fetch mint information
      const mintInfo = await getMint(connection, mintPublicKey);
      if (!mintInfo.mintAuthority || !mintInfo.mintAuthority.equals(publicKey)) {
        throw new Error('Minting is disabled or you are not the mint authority.');
      }

      // Find the associated token account for the wallet
      const destination = await getAssociatedTokenAddress(mintPublicKey, publicKey);

      // Check if the ATA exists; if not, create it
      const destinationAccount = await connection.getAccountInfo(destination);
      const transaction = new Transaction();

      if (!destinationAccount) {
        transaction.add(
          createAssociatedTokenAccountInstruction(
            publicKey, // Payer
            destination, // ATA
            publicKey, // Owner
            mintPublicKey // Mint
          )
        );
      }

      // Adjust the amount based on decimals
      const adjustedAmount = BigInt(Number(amount) * Math.pow(10, mintInfo.decimals));

      // Add mintTo instruction
      transaction.add(
        createMintToInstruction(
          mintPublicKey, // Mint
          destination, // Destination token account
          publicKey, // Mint authority
          adjustedAmount, // Amount to mint
          [] // No multi-signers
        )
      );

      // Revoke Mint Authority if disabled
      if (!enableMintAuthority) {
        transaction.add(
          createSetAuthorityInstruction(
            mintPublicKey,
            publicKey, // Current authority
            AuthorityType.MintTokens,
            null // Revoke mint authority
          )
        );
      }

      // Revoke Freeze Authority if disabled
      if (!enableFreezeAuthority) {
        transaction.add(
          createSetAuthorityInstruction(
            mintPublicKey,
            publicKey, // Current authority
            AuthorityType.FreezeAccount,
            null // Revoke freeze authority
          )
        );
      }

      // Send and confirm the transaction
      const signature = await sendTransaction(transaction, connection, {
        signers: [],
        skipPreflight: false,
      });

      await connection.confirmTransaction(signature, 'confirmed');
      console.log('Mint transaction:', signature);

      // Trigger confetti effect on success
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
      });

      toast.success(`Successfully minted ${amount} tokens to your account!`);
      if (!enableMintAuthority) {
        toast.success('Mint authority revoked.');
      }
      if (!enableFreezeAuthority) {
        toast.success('Freeze authority revoked.');
      }
    } catch (error) {
      console.error('Error minting token:', error);
      toast.error(`Error: ${(error as Error).message}`);
    } finally {
      setIsMinting(false);
    }
  };

  return isClient ? (
    <>
      {/* Animated Note Banner */}
      <div className="max-w-3xl mx-auto mt-8 px-6">
        <div className="relative bg-gradient-to-r from-purple-600 to-indigo-600 text-white p-4 rounded-xl shadow-lg transform hover:scale-105 transition-all duration-300 animate-pulse-subtle">
          <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-r from-purple-600/20 to-indigo-600/20 rounded-xl animate-pulse opacity-50"></div>
          <p className="relative text-sm font-medium">
            <span className="font-bold text-yellow-300">PRO TIP:</span> Minting is a superpower reserved for the token’s mint authority! Double-check your mint address and ensure minting hasn’t been locked.
          </p>
        </div>
      </div>

      {/* Control Panel Container */}
      <div className="relative max-w-3xl mx-auto my-12 p-8 bg-gradient-to-br from-gray-900 to-gray-800 rounded-3xl shadow-2xl overflow-hidden transform hover:shadow-[0_0_40px_rgba(99,102,241,0.5)] transition-all duration-500">
        {/* Background Particle Effect */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute w-1 h-1 bg-indigo-400 rounded-full animate-float top-10 left-20"></div>
          <div className="absolute w-2 h-2 bg-purple-400 rounded-full animate-float top-40 right-24 delay-100"></div>
          <div className="absolute w-1 h-1 bg-pink-400 rounded-full animate-float bottom-16 left-32 delay-200"></div>
        </div>

        <h1 className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-pink-500 text-center mb-10 tracking-wider animate-glow">
          🚀 Mint Your Tokens
        </h1>

        {!connected ? (
          <div className="flex justify-center mb-8">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-lg blur opacity-75 animate-pulse"></div>
              {isClient && (
                <WalletMultiButton className="relative bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-8 py-3 rounded-lg font-semibold hover:from-indigo-700 hover:to-purple-700 transition-all duration-300 shadow-md" />
              )}
            </div>
          </div>
        ) : (
          <div className="flex justify-center mb-8">
            {/* Optional: Uncomment to show WalletMultiButton */}
            {/* <WalletMultiButton className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-8 py-3 rounded-lg font-semibold hover:from-indigo-700 hover:to-purple-700 transition-all duration-300 shadow-md" /> */}
          </div>
        )}

        {connected && (
          <>
            <ToastContainer theme="dark" position="top-right" autoClose={5000} />
            {/* Mint Address Input */}
            <div className="mb-8 relative group">
              <label className="block text-sm font-bold text-indigo-300 mb-3 tracking-wide">
                Mint Address
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={mintAddress}
                  onChange={(e) => setMintAddress(e.target.value)}
                  placeholder="Enter your token mint address"
                  className="w-full px-5 py-4 bg-gray-800/50 border-2 border-indigo-500/30 rounded-xl text-white placeholder-indigo-400/50 focus:outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-500/30 transition-all duration-300 hover:bg-gray-700/50 group-hover:shadow-[0_0_20px_rgba(99,102,241,0.4)]"
                  required
                  aria-label="Token mint address"
                />
                <span className="absolute left-4 top-1/2 transform -translate-y-1/2 text-indigo-400 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                  🔗
                </span>
              </div>
            </div>

            {/* Decimals Input */}
            <div className="mb-8 relative group">
              <label className="block text-sm font-bold text-indigo-300 mb-3 tracking-wide">
                Decimals
              </label>
              <div className="relative">
                <input
                  type="number"
                  value={decimals ?? ''}
                  onChange={(e) => setDecimals(Number(e.target.value))}
                  placeholder="Set token decimals (e.g., 9)"
                  min="0"
                  className="w-full px-5 py-4 bg-gray-800/50 border-2 border-indigo-500/30 rounded-xl text-white placeholder-indigo-400/50 focus:outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-500/30 transition-all duration-300 hover:bg-gray-700/50 group-hover:shadow-[0_0_20px_rgba(99,102,241,0.4)]"
                  required
                  aria-label="Token decimals"
                />
                <span className="absolute left-4 top-1/2 transform -translate-y-1/2 text-indigo-400 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                  ⚙️
                </span>
              </div>
            </div>

            {/* Amount to Mint Input */}
            <div className="mb-8 relative group">
              <label className="block text-sm font-bold text-indigo-300 mb-3 tracking-wide">
                Amount to Mint
              </label>
              <div className="relative">
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="How many tokens to mint?"
                  min="0"
                  className="w-full px-5 py-4 bg-gray-800/50 border-2 border-indigo-500/30 rounded-xl text-white placeholder-indigo-400/50 focus:outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-500/30 transition-all duration-300 hover:bg-gray-700/50 group-hover:shadow-[0_0_20px_rgba(99,102,241,0.4)]"
                  required
                  aria-label="Amount to mint"
                />
                <span className="absolute left-4 top-1/2 transform -translate-y-1/2 text-indigo-400 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                  💰
                </span>
              </div>
            </div>

            {/* Mint Authority Toggle */}
            <div className="mb-8">
              <label className="block text-sm font-bold text-indigo-300 mb-3 tracking-wide">
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
                  <div className={`w-16 h-8 rounded-full transition-all duration-300 ${enableMintAuthority ? 'bg-gradient-to-r from-indigo-500 to-purple-500' : 'bg-gray-600'}`}>
                    <div
                      className={`absolute top-1 left-1 w-6 h-6 bg-white rounded-full shadow-md transform transition-all duration-300 ${enableMintAuthority ? 'translate-x-8' : ''}`}
                    ></div>
                  </div>
                </label>
                <span className="text-sm text-indigo-200">
                  {enableMintAuthority ? '🔓 Unlocked' : '🔒 Locked'}
                </span>
              </div>
              <p className="text-xs text-indigo-400 mt-2">
                Lock the mint to stop all future token creation. Choose wisely!
              </p>
            </div>

            {/* Freeze Authority Toggle */}
            <div className="mb-10">
              <label className="block text-sm font-bold text-indigo-300 mb-3 tracking-wide">
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
                  <div className={`w-16 h-8 rounded-full transition-all duration-300 ${enableFreezeAuthority ? 'bg-gradient-to-r from-indigo-500 to-purple-500' : 'bg-gray-600'}`}>
                    <div
                      className={`absolute top-1 left-1 w-6 h-6 bg-white rounded-full shadow-md transform transition-all duration-300 ${enableFreezeAuthority ? 'translate-x-8' : ''}`}
                    ></div>
                  </div>
                </label>
                <span className="text-sm text-indigo-200">
                  {enableFreezeAuthority ? '🧊 Freezable' : '🔥 Unfreezable'}
                </span>
              </div>
              <p className="text-xs text-indigo-400 mt-2">
                Disable freezing to ensure tokens are always transferable.
              </p>
            </div>

            {/* Mint Button */}
            <div className="flex justify-center">
              <button
                onClick={handleMintToken}
                disabled={isMinting || !connected}
                className="relative w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-8 py-4 rounded-xl font-bold text-lg hover:from-indigo-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 shadow-lg group overflow-hidden"
              >
                <span className="absolute inset-0 bg-gradient-to-r from-indigo-500 to-purple-500 opacity-0 group-hover:opacity-30 transition-opacity duration-300"></span>
                <span className="relative flex items-center justify-center gap-3">
                  {isMinting ? (
                    <>
                      <svg
                        className="animate-spin h-6 w-6 text-white"
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
                      Launching...
                    </>
                  ) : (
                    <>
                      <span className="animate-pulse">🌟 Mint Tokens</span>
                    </>
                  )}
                </span>
              </button>
            </div>
          </>
        )}
      </div>

      {/* CSS for Animations */}
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
            text-shadow: 0 0 10px rgba(99, 102, 241, 0.5);
          }
          50% {
            text-shadow: 0 0 20px rgba(99, 102, 241, 0.8);
          }
          100% {
            text-shadow: 0 0 10px rgba(99, 102, 241, 0.5);
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

export default MintToken;
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { Connection, PublicKey } from '@solana/web3.js';
import { AnchorProvider, BN, Wallet } from '@project-serum/anchor';
import { getMint } from '@solana/spl-token';
import '@solana/wallet-adapter-react-ui/styles.css';
import Link from 'next/link';
import { Metaplex } from '@metaplex-foundation/js';
import { getProgram } from '../utils/useprogram';

// ICOData Type
type ICOData = {
  tokenMint: string;
  tokenName: string;
  startDate: string;
  endDate: string;
  price: number;
  totalSupply: string;
  status: 'active' | 'upcoming' | 'expired';
};

function formatDate(date: Date): string {
  return date.toLocaleString('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

export const IcoSummaryDashboard = () => {
  const [icos, setIcos] = useState<ICOData[]>([]);
  const [loading, setLoading] = useState(true);
  const { wallet, connected } = useWallet();

  // Convert Lamports to SOL
  const lamportsToSol = (lamports: BN) => {
    return (lamports.toNumber() / 1_000_000_000).toFixed(9);
  };

  // Format token supply based on decimals
  const formatTokenAmount = (amount: BN, decimals: number) => {
    const divisor = Math.pow(10, decimals);
    return (amount.toNumber() / divisor).toFixed(decimals);
  };

  // Fetch token name using Metaplex or fallback to Solana Token List
  const fetchTokenName = useCallback(async (mintAddress: string, metaplex: Metaplex): Promise<string> => {
    try {
      console.log(`Fetching metadata for mint: ${mintAddress}`);
      const mintPubkey = new PublicKey(mintAddress);
      const metadataAccount = await metaplex.nfts().findByMint({ mintAddress: mintPubkey });

      if (metadataAccount && metadataAccount.name) {
        console.log(`Metaplex metadata found for ${mintAddress}:`, metadataAccount.name);
        return metadataAccount.name.replace(/\0/g, '').trim() || mintAddress.slice(0, 8);
      } else {
        console.log(`No Metaplex metadata found for ${mintAddress}, trying Solana Token List`);
        // Fallback to Solana Token List
        const tokenListName = await fetchTokenNameFromTokenList(mintAddress);
        return tokenListName || mintAddress.slice(0, 8);
      }
    } catch (err) {
      console.error(`Error fetching Metaplex metadata for mint ${mintAddress}:`, err);
      console.log(`Falling back to Solana Token List for ${mintAddress}`);
      // Fallback to Solana Token List
      const tokenListName = await fetchTokenNameFromTokenList(mintAddress);
      return tokenListName || mintAddress.slice(0, 8);
    }
  }, []);

  // Fetch token metadata (name and decimals)
  const getTokenMetadata = useCallback(async (
    mintAddress: string | undefined,
    connection: Connection,
    metaplex: Metaplex
  ): Promise<{ decimals: number; name: string }> => {
    if (!mintAddress) return { decimals: 0, name: 'Unknown' };

    try {
      const mintPubkey = new PublicKey(mintAddress);
      const mintInfo = await getMint(connection, mintPubkey);

      // Fetch token name
      const name = await fetchTokenName(mintAddress, metaplex);
      return { decimals: mintInfo.decimals, name };
    } catch (err) {
      console.error(`Error fetching token metadata for mint ${mintAddress}:`, err);
      return { decimals: 0, name: 'Unknown' };
    }
  }, [fetchTokenName]);

  // Fetch ICO details
  useEffect(() => {
    const fetchICOs = async () => {
      setLoading(true);

      try {
        if (!wallet) throw new Error('Wallet is not connected');
        const connection = new Connection('https://api.devnet.solana.com');
        const provider = new AnchorProvider(connection, wallet as unknown as Wallet, {
          commitment: 'confirmed',
        });
        const program = getProgram(provider);

        const allICOAccounts = await program.account.icoState.all();

        const metaplex = new Metaplex(connection);

        const formatted: ICOData[] = await Promise.all(
          allICOAccounts.map(async (item): Promise<ICOData> => {
            const startBN = item.account.startDate as BN;
            const endBN = item.account.endDate as BN;
            const priceBN = item.account.tokenPrice as BN;
            const supplyBN = item.account.tokenAmount as BN;
            const mintAddress = item.account.tokenMint?.toBase58();

            // Fetch token metadata
            const { decimals, name } = await getTokenMetadata(mintAddress, connection, metaplex);

            const startDate = new Date(startBN.toNumber() * 1000);
            const endDate = new Date(endBN.toNumber() * 1000);
            const now = new Date();

            const price = lamportsToSol(priceBN);
            const supply = formatTokenAmount(supplyBN, decimals);

            const status =
              now < startDate
                ? 'upcoming'
                : now > endDate
                ? 'expired'
                : 'active';

            return {
              tokenMint: mintAddress ?? 'Unknown',
              tokenName: name || 'Unknown',
              startDate: formatDate(startDate),
              endDate: formatDate(endDate),
              price: parseFloat(price),
              totalSupply: supply,
              status,
            };
          })
        );

        setIcos(formatted);
      } catch (error) {
        console.error('Error fetching ICOs:', error);
      } finally {
        setLoading(false);
      }
    };

    if (connected && wallet) {
      fetchICOs();
    }
  }, [connected, wallet, getTokenMetadata]);

  // Fetch token name from Solana Token List (off-chain fallback)
  const fetchTokenNameFromTokenList = async (mintAddress: string): Promise<string | null> => {
    try {
      const response = await fetch('https://raw.githubusercontent.com/solana-labs/token-list/main/src/tokens/solana.tokenlist.json');
      const tokenList = await response.json();
      const token = tokenList.tokens.find(
        (t: { address: string; name: string }) => t.address === mintAddress
      );
      if (token) {
        console.log(`Token List metadata found for ${mintAddress}:`, token.name);
        return token.name;
      } else {
        console.log(`No Token List metadata found for ${mintAddress}`);
        return null;
      }
    } catch (err) {
      console.error(`Error fetching Solana Token List for mint ${mintAddress}:`, err);
      return null;
    }
  };

  return (
    <div className="container mx-auto p-4 sm:p-6 lg:p-8 bg-gradient-to-br from-indigo-50 to-gray-100 min-h-screen">
      <div className="flex flex-col sm:flex-row justify-between items-center mb-8">
        <h1 className="text-3xl sm:text-4xl font-extrabold text-gray-900 tracking-tight mb-4 sm:mb-0">
          ICO Summary Dashboard
        </h1>
      </div>
  
      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="flex items-center gap-3 text-gray-600 text-lg font-semibold">
            <svg className="animate-spin h-6 w-6 text-indigo-600" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            Loading ICOs...
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full table-auto">
              <thead className="bg-indigo-50">
                <tr className="border-b border-indigo-200">
                  <th className="px-4 py-3 sm:px-6 sm:py-4 text-left text-sm font-semibold text-gray-800">Token Name</th>
                  <th className="px-4 py-3 sm:px-6 sm:py-4 text-left text-sm font-semibold text-gray-800">Token Mint</th>
                  <th className="px-4 py-3 sm:px-6 sm:py-4 text-left text-sm font-semibold text-gray-800">Start Date</th>
                  <th className="px-4 py-3 sm:px-6 sm:py-4 text-left text-sm font-semibold text-gray-800">End Date</th>
                  <th className="px-4 py-3 sm:px-6 sm:py-4 text-left text-sm font-semibold text-gray-800">Price (SOL)</th>
                  <th className="px-4 py-3 sm:px-6 sm:py-4 text-left text-sm font-semibold text-gray-800">Total Supply</th>
                  <th className="px-4 py-3 sm:px-6 sm:py-4 text-left text-sm font-semibold text-gray-800">Status</th>
                </tr>
              </thead>
              <tbody>
                {icos.map((ico, index) => (
                  <tr
                    key={index}
                    className="border-b border-gray-100 hover:bg-indigo-50 transition-all duration-200"
                  >
                    <td className="px-4 py-3 sm:px-6 sm:py-4 text-sm">
                      <Link href={`/actions?mint=${ico.tokenMint}`}>
                        <button
                          className="text-indigo-600 hover:text-indigo-800 font-medium cursor-pointer"
                          title="Click to contribute"
                        >
                          {ico.tokenName}
                        </button>
                      </Link>
                    </td>
                    <td className="px-4 py-3 sm:px-6 sm:py-4 text-gray-900 font-mono text-sm truncate max-w-[150px] sm:max-w-none">
                      <a
                        href={`https://explorer.solana.com/address/${ico.tokenMint}?cluster=devnet`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline"
                      >
                        {ico.tokenMint}
                      </a>
                    </td>
                    <td className="px-4 py-3 sm:px-6 sm:py-4 text-gray-600 text-sm">{ico.startDate}</td>
                    <td className="px-4 py-3 sm:px-6 sm:py-4 text-gray-600 text-sm">{ico.endDate}</td>
                    <td className="px-4 py-3 sm:px-6 sm:py-4 text-gray-600 text-sm">{ico.price}</td>
                    <td className="px-4 py-3 sm:px-6 sm:py-4 text-gray-600 text-sm">{ico.totalSupply}</td>
                    <td className="px-4 py-3 sm:px-6 sm:py-4">
                      <span
                        className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium transition-all duration-200
                          ${
                            ico.status === 'active'
                              ? 'bg-green-100 text-green-800'
                              : ico.status === 'upcoming'
                              ? 'bg-yellow-100 text-yellow-800'
                              : 'bg-red-100 text-red-800'
                          }`}
                      >
                        <span
                          className={`w-2 h-2 rounded-full mr-2
                            ${
                              ico.status === 'active'
                                ? 'bg-green-500'
                                : ico.status === 'upcoming'
                                ? 'bg-yellow-500'
                                : 'bg-red-500'
                            }`}
                        ></span>
                        {ico.status.charAt(0).toUpperCase() + ico.status.slice(1)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
  
};
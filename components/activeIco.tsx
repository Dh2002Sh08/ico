'use client';

import { useState, useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { Connection, PublicKey } from '@solana/web3.js';
import { AnchorProvider, BN, Wallet } from '@project-serum/anchor';
// import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import '@solana/wallet-adapter-react-ui/styles.css';

import { getProgram } from '../utils/useprogram';

// ICOData Type
type ICOData = {
  tokenMint: string;
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

  // Function to convert Lamports to SOL (for price)
  const lamportsToSol = (lamports: BN) => {
    return (lamports.toNumber() / 1_000_000_000).toFixed(9); // Convert to SOL (9 decimals)
  };

  // Function to format token supply based on decimals
  const formatTokenAmount = (amount: BN, decimals: number) => {
    const divisor = Math.pow(10, decimals);
    return (amount.toNumber() / divisor).toFixed(decimals); // Format based on token's decimals
  };

  // Function to fetch ICO details
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
        console.log('allICOAccounts:', allICOAccounts);

        const formatted: ICOData[] = await Promise.all(
          allICOAccounts.map(async (item): Promise<ICOData> => {
            const startBN = item.account.startDate as BN;
            const endBN = item.account.endDate as BN;
            const priceBN = item.account.tokenPrice as BN;
            const supplyBN = item.account.tokenAmount as BN;
            const mintAddress = item.account.tokenMint?.toBase58(); // Token Mint Address

            // Get the token's mint information (decimals)
            const tokenDecimals = await getTokenDecimals(mintAddress);

            const startDate = new Date(startBN.toNumber() * 1000);
            const endDate = new Date(endBN.toNumber() * 1000);
            const now = new Date();

            const price = lamportsToSol(priceBN); // Price in SOL
            const supply = formatTokenAmount(supplyBN, tokenDecimals); // Supply formatted based on decimals

            const status =
              now < startDate
                ? 'upcoming'
                : now > endDate
                ? 'expired'
                : 'active';

            return {
              tokenMint: mintAddress ?? 'Unknown',
              startDate: formatDate(startDate),
              endDate: formatDate(endDate),
              price: parseFloat(price),
              totalSupply: supply, // Use formatted total supply
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
  }, [connected, wallet]);

  // Fetch token's decimals using its mint address
  const getTokenDecimals = async (mintAddress: string | undefined): Promise<number> => {
    if (!mintAddress) return 0;

    try {
        const connection = new Connection('https://api.devnet.solana.com');
        const mintPubkey = new PublicKey(mintAddress);
        const accountInfo = await connection.getParsedAccountInfo(mintPubkey);

        if (
            accountInfo.value &&
            'data' in accountInfo.value &&
            typeof accountInfo.value.data !== 'string' &&
            'parsed' in accountInfo.value.data
        ) {
            const parsedInfo = accountInfo.value.data.parsed.info;
            return parsedInfo.decimals || 0;
        }

        return 0;
    } catch (err) {
        console.error('Error fetching decimals:', err);
        return 0;
    }
};

  return (
    <div className="container mx-auto p-4">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">ICO Summary Dashboard</h1>
        {/* <WalletMultiButton /> */}
      </div>

      {loading ? (
        <div>Loading ICOs...</div>
      ) : (
        <table className="min-w-full table-auto">
          <thead>
            <tr className="border-b">
              <th className="px-4 py-2 text-left">Token Mint</th>
              <th className="px-4 py-2 text-left">Start Date</th>
              <th className="px-4 py-2 text-left">End Date</th>
              <th className="px-4 py-2 text-left">Price (SOL)</th>
              <th className="px-4 py-2 text-left">Total Supply</th>
              <th className="px-4 py-2 text-left">Status</th>
            </tr>
          </thead>
          <tbody>
            {icos.map((ico, index) => (
              <tr key={index} className="border-b">
                <td className="px-4 py-2">{ico.tokenMint}</td>
                <td className="px-4 py-2">{ico.startDate}</td>
                <td className="px-4 py-2">{ico.endDate}</td>
                <td className="px-4 py-2">{ico.price}</td>
                <td className="px-4 py-2">{ico.totalSupply}</td>
                <td className="px-4 py-2">
                  <span
                    className={`${
                      ico.status === 'active'
                        ? 'bg-green-500 text-white'
                        : ico.status === 'upcoming'
                        ? 'bg-yellow-500 text-white'
                        : 'bg-red-500 text-white'
                    } px-3 py-1 rounded-full`}
                  >
                    {ico.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};

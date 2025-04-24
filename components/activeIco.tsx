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
  <div className="container mx-auto p-6 bg-gradient-to-br from-gray-50 to-gray-100 min-h-screen">
    <div className="flex justify-between items-center mb-6">
      <h1 className="text-4xl font-extrabold text-gray-900 tracking-tight">
        ICO Summary Dashboard
      </h1>
      {/* <WalletMultiButton /> */}
    </div>

    {loading ? (
      <div className="flex justify-center items-center h-64">
        <div className="flex items-center gap-3 text-gray-600 text-lg font-semibold">
          <svg
            className="animate-spin h-6 w-6 text-indigo-500"
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
          Loading ICOs...
        </div>
      </div>
    ) : (
      <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
        <table className="min-w-full table-auto">
          <thead className="bg-gray-50">
            <tr className="border-b border-gray-200">
              <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">
                Token Mint
              </th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">
                Start Date
              </th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">
                End Date
              </th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">
                Price (SOL)
              </th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">
                Total Supply
              </th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">
                Status
              </th>
            </tr>
          </thead>
          <tbody>
            {icos.map((ico, index) => (
              <tr
                key={index}
                className="border-b border-gray-100 hover:bg-gray-50 transition-all duration-200"
              >
                <td className="px-6 py-4 text-gray-900 font-mono text-sm">
                  {ico.tokenMint}
                </td>
                <td className="px-6 py-4 text-gray-600 text-sm">
                  {ico.startDate}
                </td>
                <td className="px-6 py-4 text-gray-600 text-sm">{ico.endDate}</td>
                <td className="px-6 py-4 text-gray-600 text-sm">{ico.price}</td>
                <td className="px-6 py-4 text-gray-600 text-sm">
                  {ico.totalSupply}
                </td>
                <td className="px-6 py-4">
                  <span
                    className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium transition-all duration-200
                      ${
                        ico.status === "active"
                          ? "bg-green-100 text-green-800"
                          : ico.status === "upcoming"
                          ? "bg-yellow-100 text-yellow-800"
                          : "bg-red-100 text-red-800"
                      }`}
                  >
                    <span
                      className={`w-2 h-2 rounded-full mr-2
                        ${
                          ico.status === "active"
                            ? "bg-green-500"
                            : ico.status === "upcoming"
                            ? "bg-yellow-500"
                            : "bg-red-500"
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
    )}
  </div>
);

};

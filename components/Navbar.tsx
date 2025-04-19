'use client';

import Link from 'next/link';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import '@solana/wallet-adapter-react-ui/styles.css';

const Navbar = () => {
  return (
    <nav className="bg-gray-900 text-white px-6 py-4 flex justify-between items-center shadow-md">
      <div className="flex space-x-6 items-center">
        <Link href="/ico" className="hover:text-yellow-400 font-medium">ICO</Link>
        <Link href="/dashboard" className="hover:text-yellow-400 font-medium">Dashboard</Link>
        <Link href="/createToken" className="hover:text-yellow-400 font-medium">Create Token</Link>
        <Link href="/whitepaper" className="hover:text-yellow-400 font-medium">Create Whitepaer</Link>
      </div>
      <WalletMultiButton />
    </nav>
  );
};

export default Navbar;

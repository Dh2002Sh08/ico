'use client';

import Link from 'next/link';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import '@solana/wallet-adapter-react-ui/styles.css';
import { useState, useEffect } from 'react';
import { Menu, X } from 'lucide-react';

const Navbar = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isVisible, setIsVisible] = useState(true);
  let lastScrollY = typeof window !== 'undefined' ? window.scrollY : 0;

  const toggleMenu = () => {
    setIsOpen(!isOpen);
  };

  const handleScroll = () => {
    const currentScrollY = window.scrollY;
    if (currentScrollY > lastScrollY && currentScrollY > 50) {
      // Scrolling down and past 50px
      setIsVisible(false);
    } else {
      // Scrolling up or near the top
      setIsVisible(true);
    }
    lastScrollY = currentScrollY;
  };

  useEffect(() => {
    window.addEventListener('scroll', handleScroll);
    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  return (
    <nav className={`bg-gradient-to-r from-gray-900 via-purple-900 to-gray-900 text-white px-6 py-4 shadow-lg sticky top-0 z-50 transition-transform duration-300 ${isVisible ? 'translate-y-0' : '-translate-y-full'}`}>
      <div className="max-w-7xl mx-auto flex justify-between items-center">
        {/* Logo / Brand */}
        <div className="flex items-center">
          <Link href="/" className="text-3xl font-bold tracking-tight hover:text-purple-200 transition-colors duration-200">
            ICO Platform
          </Link>
        </div>

        {/* Desktop Menu */}
        <div className="hidden lg:flex space-x-8 items-center">
          <Link href="/ico" className="text-base font-medium hover:text-purple-200 transition-colors duration-200">
            ICO
          </Link>
          <Link href="/dashboard" className="text-base font-medium hover:text-purple-200 transition-colors duration-200">
            Dashboard
          </Link>
          <Link href="/createToken" className="text-base font-medium hover:text-purple-200 transition-colors duration-200">
            Create Token
          </Link>
          <Link href="/TokenMint" className="text-base font-medium hover:text-purple-200 transition-colors duration-200">
            Token Mint
          </Link>
          <Link href="/whitepaper" className="text-base font-medium hover:text-purple-200 transition-colors duration-200">
            Whitepaper
          </Link>
          <WalletMultiButton className="!bg-gradient-to-r !from-purple-700 !to-purple-900 !text-white !rounded-lg !px-4 !py-2 !font-semibold !text-base hover:!from-purple-800 hover:!to-purple-950 transition-colors duration-200" />
        </div>

        {/* Mobile Menu Button */}
        <div className="lg:hidden flex items-center">
          <button onClick={toggleMenu} className="text-white focus:outline-none cursor-pointer">
            {isOpen ? <X size={28} /> : <Menu size={28} />}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {isOpen && (
        <div className="lg:hidden bg-gradient-to-r from-gray-900 via-purple-900 to-gray-900 px-6 py-4 space-y-4">
          <Link
            href="/ico"
            className="block text-base font-medium hover:text-purple-200 transition-colors duration-200"
            onClick={toggleMenu}
          >
            ICO
          </Link>
          <Link
            href="/dashboard"
            className="block text-base font-medium hover:text-purple-200 transition-colors duration-200"
            onClick={toggleMenu}
          >
            Dashboard
          </Link>
          <Link
            href="/createToken"
            className="block text-base font-medium hover:text-purple-200 transition-colors duration-200"
            onClick={toggleMenu}
          >
            Create Token
          </Link>
          <Link
            href="/TokenMint"
            className="block text-base font-medium hover:text-purple-200 transition-colors duration-200"
            onClick={toggleMenu}
          >
            Token Mint
          </Link>
          <Link
            href="/whitepaper"
            className="block text-base font-medium hover:text-purple-200 transition-colors duration-200"
            onClick={toggleMenu}
          >
            Whitepaper
          </Link>
          <div className="pt-2">
            <WalletMultiButton />
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar;
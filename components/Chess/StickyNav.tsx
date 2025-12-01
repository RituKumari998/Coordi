import React from 'react';
import { FaWallet } from 'react-icons/fa';

export function StickyNav({ onWalletClick }: { onWalletClick: () => void }) {
  return (
    <nav className="fixed bottom-0 left-0 w-full bg-gradient-to-r from-blue-900 to-purple-900 shadow-lg z-50">
      <div className="flex justify-center items-center py-3">
        <button
          onClick={onWalletClick}
          className="flex flex-col items-center justify-center px-6 py-2 rounded-xl text-white font-semibold hover:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-400 transition-all"
        >
          <FaWallet className="text-2xl mb-1" />
          <span className="text-xs">Wallet</span>
        </button>
      </div>
    </nav>
  );
} 
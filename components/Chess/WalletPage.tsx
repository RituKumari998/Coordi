import React, { useEffect, useState } from 'react';
import { parseEther } from 'viem';
import { FaSync, FaCheckCircle } from 'react-icons/fa';
import { useAccount, useSendTransaction, useReadContract, useSwitchChain, useChainId } from 'wagmi';
import { monadTestnet } from 'viem/chains';

const CONTRACT_ADDRESS = "0x9359c146e36771143B8fE180F34037Fb1297a44E";
const ABI = [
  {
    type: 'function',
    name: 'getPlayerBalance',
    stateMutability: 'view',
    inputs: [{ name: '_player', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'withdraw',
    stateMutability: 'nonpayable',
    inputs: [],
    outputs: [],
  },
];

export function WalletPage({ onClose }: { onClose: () => void }) {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();
  const { data, isLoading, error, refetch } = useReadContract({
    address: CONTRACT_ADDRESS as `0x${string}`,
    abi: ABI,
    functionName: 'getPlayerBalance',
    args: [address as `0x${string}`],
  });
  const { sendTransaction, isPending, data: txHash, isSuccess } = useSendTransaction();
  const [loading, setLoading] = useState(false);
  const [displayBalance, setDisplayBalance] = useState('0');

  useEffect(() => {
    if (data) {
      const formatted = Number(data) / 1e18;
      setDisplayBalance(formatted.toFixed(6));
    }
  }, [data]);

  const handleRefresh = async () => {
    await refetch();
  };

  const withdraw = async () => {
    setLoading(true);
    try {
      if (chainId !== monadTestnet.id) {
        await switchChain({ chainId: monadTestnet.id });
      }
      await sendTransaction({
        to: CONTRACT_ADDRESS as `0x${string}`,
        data: '0x3ccfd60b', // withdraw()
      });
    } catch (e) {
      alert('Withdraw failed');
    } finally {
      setLoading(false);
    }
  };

  if (!isConnected) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-end justify-center z-50">
      <div className="w-full max-w-md bg-gradient-to-br from-blue-900 to-purple-900 rounded-t-2xl p-6 shadow-2xl">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-white">Wallet</h2>
          <button onClick={onClose} className="text-white text-2xl">&times;</button>
        </div>
        <div className="flex flex-col items-center space-y-4">
          <div className="text-3xl font-mono text-yellow-300">{displayBalance} USDC</div>
          <button
            onClick={handleRefresh}
            disabled={isLoading}
            className="flex items-center gap-2 px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white rounded-lg shadow"
          >
            <FaSync className={isLoading ? 'animate-spin' : ''} /> Refresh
          </button>
          {chainId !== monadTestnet.id ? (
            <button
              onClick={() => switchChain({ chainId: monadTestnet.id })}
              className="w-full bg-gradient-to-r from-yellow-400 to-orange-500 text-white font-semibold py-2 px-6 rounded-xl shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200"
            >
              Switch to Monad Testnet
            </button>
          ) : (
            <button
              onClick={withdraw}
              disabled={loading || displayBalance === '0.000000'}
              className="w-full bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white font-semibold py-2 px-6 rounded-xl shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200"
            >
              {isPending || loading ? 'Withdrawing...' : 'Withdraw'}
            </button>
          )}
          {error && <div className="text-red-400">{error.message}</div>}
          {txHash && (
            <a
              href={`https://testnet.monadexplorer.com/tx/${txHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-green-300 mt-2"
            >
              <FaCheckCircle /> View Transaction
            </a>
          )}
        </div>
      </div>
    </div>
  );
} 
"use client"

import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createAppKit } from '@reown/appkit/react'
import { WagmiAdapter } from '@reown/appkit-adapter-wagmi'
import { base } from '@reown/appkit/networks'
import { WagmiProvider } from 'wagmi'
import { farcasterMiniApp as miniAppConnector } from '@farcaster/miniapp-wagmi-connector'
import type { AppKitOptions } from '@reown/appkit'

// Get Reown/WalletConnect Project ID from environment or use a default
const projectId = process.env.NEXT_PUBLIC_REOWN_PROJECT_ID || 'demo-project-id'



// Set up Wagmi Adapter with Farcaster connector and enhanced configuration
const wagmiAdapter = new WagmiAdapter({
  networks: base,
  projectId,
  ssr: true,
  connectors: [
    miniAppConnector(), // Add Farcaster Mini App connector
  ],
})

// Enhanced AppKit configuration with more Reown features
const appKitOptions: AppKitOptions = {
  adapters: [wagmiAdapter],
  networks: base,
  projectId,
  metadata: {
    name: 'Coordi',
    description: 'Coordi Mini App ',
    url: 'https://Coordi.vercel.app',
    icons: ['https://Coordi.vercel.app/images/icon.jpg']
  },
  features: {
    analytics: false, // Disable analytics to prevent extra renders
    email: true, // Enable email login via Reown embedded wallets
    socials: true, // Enable social logins via Reown
    onramp: true, // Enable on-ramp for crypto purchases
    emailShowWallets: true, // Show wallet options in email flow
    socialsShowWallets: true, // Show wallet options in social flow
  },
  themeMode: 'dark',
  themeVariables: {
    '--w3m-accent': '#3b99fc',
    '--w3m-border-radius-master': '16px',
    '--w3m-font-family': 'system-ui, -apple-system, sans-serif',
  },
  allWallets: 'SHOW', // Show all available wallets
  enableEIP6963: true, // Enable EIP-6963 wallet discovery
  enableCoinbase: true, // Explicitly enable Coinbase wallet
  enableNetworkView: true, // Enable network switching view
  enableAccountView: true, // Enable account management view
  enableExplorer: true, // Enable block explorer links
}

// Create AppKit instance with enhanced configuration
createAppKit(appKitOptions)

// Export the wagmi config
// This includes:
// - Farcaster Mini App connector (for in-app usage)
// - All wallets supported by Reown AppKit (MetaMask, Coinbase, etc.)
// - Multi-chain network support
export const config = wagmiAdapter.wagmiConfig

// Export AppKit instance for direct access if needed
export { wagmiAdapter, appKitOptions }

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      refetchOnMount: false,
      refetchOnReconnect: false,
      staleTime: 5 * 60 * 1000,
    },
  },
})

// Re-export commonly used Reown utilities and configurations
export { monad, ethereum, polygon, arbitrum, base, optimism } from '@reown/appkit/networks'
export type { AppKitOptions } from '@reown/appkit'

// Export project ID for use in other components
export const REOWN_PROJECT_ID = projectId

// Export supported networks array for reuse
  export const SUPPORTED_NETWORKS = base

export function WalletProvider({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </WagmiProvider>
  )
}

import logo from "./logo.svg";
import { WalletAdapterNetwork } from "@solana/wallet-adapter-base";
import { WalletModalProvider, WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { ConnectionProvider, WalletProvider, useAnchorWallet } from "@solana/wallet-adapter-react";
import {
    GlowWalletAdapter,
    PhantomWalletAdapter,
    SlopeWalletAdapter,
    SolflareWalletAdapter,
    TorusWalletAdapter,
} from "@solana/wallet-adapter-wallets";
import { clusterApiUrl } from "@solana/web3.js";
import React, { FC, ReactNode, useMemo } from "react";
import { Transactions } from "./Transactions";

require("./App.css");
require("@solana/wallet-adapter-react-ui/styles.css");

const network = WalletAdapterNetwork.Devnet;

const App: FC = () => {
    return (
        <Context>
            <Content />
        </Context>
    );
};
export default App;

const Context: FC<{ children: ReactNode }> = ({ children }) => {
    const endpoint = useMemo(() => clusterApiUrl(network), []);
    const wallets = useMemo(
        () => [
          new PhantomWalletAdapter(),
          new GlowWalletAdapter(),
          new SlopeWalletAdapter(),
          new SolflareWalletAdapter({ network }),
          new TorusWalletAdapter(),
        ],
        []
      );

      return (
        <ConnectionProvider endpoint={endpoint}>
          <WalletProvider wallets={wallets} autoConnect>      
            <div className="App">
                {children}
                <img src={logo} className="App-logo" alt="logo" />
            </div>
          </WalletProvider>
        </ConnectionProvider>
      );
};

const Content: FC = () => {    
    const wallet = useAnchorWallet();
    const ownerAccount = wallet?.publicKey;  

    return (
        <>
            {(wallet &&
                <p>Your wallet is {ownerAccount?.toString()}</p>) ||
                (<p>Click the button to connect</p>)
            }
            <WalletModalProvider>
                <WalletMultiButton />
                <Transactions />
            </WalletModalProvider>
        </>
    );
};
  
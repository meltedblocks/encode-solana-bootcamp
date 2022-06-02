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
import { clusterApiUrl, Connection, SystemProgram, SYSVAR_RENT_PUBKEY } from "@solana/web3.js";
import { Program, AnchorProvider, web3, BN, utils } from "@project-serum/anchor";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import React, { FC, ReactNode, useMemo } from "react";
import idl from "./idl.json";

require("./App.css");
require("@solana/wallet-adapter-react-ui/styles.css");

const App: FC = () => {
    return (
        <Context>
            <Content />
        </Context>
    );
};
export default App;

const Context: FC<{ children: ReactNode }> = ({ children }) => {
    const network = WalletAdapterNetwork.Mainnet;
    const endpoint = useMemo(() => clusterApiUrl(network), [network]);
    const wallets = useMemo(
        () => [
          new PhantomWalletAdapter(),
          new GlowWalletAdapter(),
          new SlopeWalletAdapter(),
          new SolflareWalletAdapter({ network }),
          new TorusWalletAdapter(),
        ],
        [network]
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
    const baseAccount = web3.Keypair.generate();
    
    function getProvider() {
        if(!wallet) {
            return null;
        }
        const network = "http://127.0.0.1:8899";        
        const connection = new Connection(network, "processed");
        
        const provider = new AnchorProvider(
            connection, wallet, {"preflightCommitment": "processed"}
        );
        return provider;
    }

    async function initializeLottery() {
        const provider = getProvider();
        const program = new Program(idl as any, idl.metadata.address, provider as any);
        const [lotteryOwner] = await web3.PublicKey.findProgramAddress(
            [baseAccount.publicKey.toBytes(), utils.bytes.utf8.encode("lottery-owner-account")],
            program.programId
        );

        const [lottery] = await web3.PublicKey.findProgramAddress(
            [lotteryOwner.toBytes(), new BN(0).toArrayLike(Buffer, "le", 1), utils.bytes.utf8.encode("lottery")],
            program.programId
        );
        const [lotteryTokenAccount, lotteryBump] = await web3.PublicKey.findProgramAddress(
            [lottery.toBytes(), utils.bytes.utf8.encode("lottery-token-account")],
            program.programId
        );
        
        try {
            await program.methods.initializeLottery(new BN(100), new BN(0),{
                accounts: {
                    owner: baseAccount.publicKey,
                    lotteryOwner,
                    //ownerTokenAccount,
                    //ownerTokenMint,
                    lottery,
                    lotteryTokenAccount,
                    rent: SYSVAR_RENT_PUBKEY,
                    tokenProgram: TOKEN_PROGRAM_ID,
                    systemProgram: SystemProgram.programId
                }
            })

        } catch (err) {

        }
    }



    const walletAddress = wallet?.publicKey.toString();
    return (
        <>
            {(wallet &&
                <p>Your wallet is {walletAddress}</p>) ||
                (<p>Click the button to connect</p>)
            }
            <WalletModalProvider>
                <WalletMultiButton />
            </WalletModalProvider>
        </>
    );
};
  
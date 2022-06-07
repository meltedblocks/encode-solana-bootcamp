import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { WalletModalProvider, WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { clusterApiUrl } from "@solana/web3.js";
import { WalletAdapterNetwork, WalletError } from "@solana/wallet-adapter-base";
import {
    GlowWalletAdapter,
    PhantomWalletAdapter,
    SlopeWalletAdapter,
    SolflareWalletAdapter,
    TorusWalletAdapter,
} from "@solana/wallet-adapter-wallets";
import TokenOutlinedIcon from "@mui/icons-material/TokenOutlined";
import React, { FC, ReactNode, useCallback, useMemo } from "react";
import { Box, Toolbar, Typography } from "@mui/material";
import AppBar from "@mui/material/AppBar";
import { useSnackbar } from "notistack";

require("@solana/wallet-adapter-react-ui/styles.css");

const network = WalletAdapterNetwork.Devnet;

export const Header: FC<{ children: ReactNode }> = ({ children }) => {

    const endpoint = useMemo(() => clusterApiUrl(network), []);
    const wallets = useMemo(
        () => [
          new PhantomWalletAdapter(),
          new GlowWalletAdapter(),
          new SlopeWalletAdapter(),
          new SolflareWalletAdapter({ network }),
          new TorusWalletAdapter()
        ],
        []
    );
    const { enqueueSnackbar } = useSnackbar();
    const onError = useCallback(
        (error: WalletError) => {
            enqueueSnackbar(error.message ? `${error.name}: ${error.message}` : error.name, { variant: 'error' });
            console.error(error);
        },
        [enqueueSnackbar]
    );    

    return (
        <ConnectionProvider endpoint={endpoint}>
          <WalletProvider wallets={wallets} onError={onError} autoConnect>
            <div>
              <WalletModalProvider>
              <Box sx={{ flexGrow: 1 }}>
              <AppBar position="static">
              <Toolbar>
                <TokenOutlinedIcon sx={{ display: "flex", mr: 1, fontSize: "50px" }} />
                <Typography variant="h4" component="div" sx={{ flexGrow: 1 }}>
                NFT Lottery
                </Typography>
              <WalletMultiButton />
              </Toolbar>
              </AppBar>
              </Box>
              </WalletModalProvider>
            </div>
            {children}
          </WalletProvider>
        </ConnectionProvider>        
      );
};

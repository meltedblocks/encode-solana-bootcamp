import { useAnchorWallet } from "@solana/wallet-adapter-react";
import React, { FC } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import TokenOutlinedIcon from "@mui/icons-material/TokenOutlined";
import CurrencyExchangeOutlinedIcon from '@mui/icons-material/CurrencyExchangeOutlined';
import { IconButton } from "@mui/material";
import { Link } from "react-router-dom";

require("./App.css");
require("@solana/wallet-adapter-react-ui/styles.css");

const iconButtonLabel = {
  display: "flex",
  flexDirection: "column",
  m: "100px"
}

const App: FC = () => {

    return (
      <Content />
    );
};
export default App;

const Content: FC = () => {
  const wallet = useAnchorWallet();

    return (
        <>
          {(wallet && 
            <div>
                <Box
                display="flex"
                alignItems="center"
                justifyContent="center"
                minHeight="70vh">
                <IconButton component={Link} to="/create" color="info" sx={iconButtonLabel} >
                <TokenOutlinedIcon sx={{ fontSize: "150px"}} />
                <div>
                  Create NFT Lottery
                </div>
                </IconButton>

                <IconButton component={Link} to="/play" color="info" sx={iconButtonLabel} >
                <CurrencyExchangeOutlinedIcon sx={{ fontSize: "150px" }} />
                <div>
                  Play NFT Lottery
                </div>
                </IconButton>
                </Box>
            </div>) ||
            (
              <Box
              display="flex"
              alignItems="center"
              textAlign="center"
              color="#ffffff"
              minHeight="50vh">
              <Typography variant="h5" component="div" sx={{ flexGrow: 1 }}>Please connect wallet</Typography>
              </Box>
            )
            }        
        </>
    );
};
  
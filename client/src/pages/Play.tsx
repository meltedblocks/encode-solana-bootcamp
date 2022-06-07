import React, { FC, useMemo } from "react";
import {  WalletAdapterNetwork, WalletNotConnectedError } from "@solana/wallet-adapter-base";
import { useAnchorWallet } from "@solana/wallet-adapter-react";
import { Connection, clusterApiUrl, SystemProgram, SYSVAR_RENT_PUBKEY } from "@solana/web3.js";
import { Program, AnchorProvider, web3, BN, utils, Wallet } from "@project-serum/anchor";
import { getOrCreateAssociatedTokenAccount, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import idl from "../idl.json";
import { useSnackbar } from "notistack";
import { Box, Button, Grid, MenuItem, Select, Typography } from "@mui/material";

export const Play: FC = () => {

    const wallet = useAnchorWallet();
    const currentAccount = wallet?.publicKey;
    const network = WalletAdapterNetwork.Devnet;
    const { enqueueSnackbar } = useSnackbar();
    const endpoint = useMemo(() => clusterApiUrl(network), [network]);
    //const endpoint = "http://127.0.0.1:8899";
    
    function getProvider() {
        
        if(!wallet) {
            throw new WalletNotConnectedError();
        }
        const connection = new Connection(endpoint, "processed");
        const provider = new AnchorProvider(
            connection, wallet, {"preflightCommitment": "processed"}
        );
        return provider;
    }

    async function playLottery() {
        if (!currentAccount) {
            throw new WalletNotConnectedError();
        }

        try {
            const ownerAddress = new web3.PublicKey("9Vs9V5z8VHZVrZhEQMEerd2Nb33CAtzkZViBxLJoF59B");
            const ownerTokenMint = "7tuNgpeoNiGLfKnwxbdNGXj5vvciPirYx9Z4kksT3GaV";
            const provider = getProvider();
            const program = new Program(idl as any, idl.metadata.address, provider as any);
            const [lotteryOwner] = await web3.PublicKey.findProgramAddress(
                [ownerAddress?.toBytes(), utils.bytes.utf8.encode("lottery-owner-account")],
                program.programId
            );
            let lotteryState = await program.account.lotteryOwner.fetchNullable(lotteryOwner);
            let count = lotteryState!=null?lotteryState.count:0;
            const [lottery] = await web3.PublicKey.findProgramAddress(
                [lotteryOwner.toBytes(), new BN(count-1).toArrayLike(Buffer, "le", 1), utils.bytes.utf8.encode("lottery")],
                program.programId
            );
            const [lotteryTokenAccount, lotteryBump] = await web3.PublicKey.findProgramAddress(
                [lottery.toBytes(), utils.bytes.utf8.encode("lottery-token-account")],
                program.programId
            );
            let lotteryOwnerState = await program.account.lottery.fetch(lottery);
            console.log(lotteryOwnerState);
            const nftOwner = lotteryOwnerState!=null?lotteryOwnerState.owner:null;
            const payer = wallet as Wallet;
            const mintPublicKey = new web3.PublicKey(ownerTokenMint);
            const playerTokenAccount= await getOrCreateAssociatedTokenAccount(
                provider.connection,
                payer.payer,
                mintPublicKey,
                currentAccount
            );            
            await program.methods.playLottery(lotteryBump)
            .accounts({
              player: currentAccount,
              owner: nftOwner,
              lottery,
              lotteryTokenAccount,
              ownerTokenMint,
              playerTokenAccount: playerTokenAccount.address,
              rent: SYSVAR_RENT_PUBKEY,
              tokenProgram: TOKEN_PROGRAM_ID,
              systemProgram: SystemProgram.programId,
            }).rpc();
            let lotteryStateAfterPlay = await program.account.lottery.fetch(lottery);
            if (lotteryStateAfterPlay.isWinner) {
                enqueueSnackbar("Congratulations!!, You won the lottery", { variant: "success" });
            } else {
                enqueueSnackbar("Oops!!, You lost the lottery", { variant: "warning" });
            }
        } catch (error: any) {
            enqueueSnackbar(error.message ? `${error.name}: ${error.message}` : error.name, { variant: "error" });
            console.log(error);
        }
    }

    return (
        <div>
        <Grid container>
            <Grid item xs={12} md={12}>
            <Box
            display="flex"
            flexDirection="column"
            alignItems="center"
            alignContent="center"
            alignSelf="center"
            textAlign="center">
                <Typography variant="h6" component="div" sx={{ color: "#ffffff", mt: "150px" }}>Choose a NFT</Typography>
                <Select
                    value={10}
                    //onChange={handleChange}
                    sx={{ backgroundColor: "#0288d1", mt: "15px" }}>
                    <MenuItem value={10}>7tuNgpeoNiGLfKnwxbdNGXj5vvciPirYx9Z4kksT3GaV</MenuItem>
                </Select>                
                <Button variant="contained" sx={{ mt: "15px" }} onClick={playLottery}>Play Lottery</Button>
            </Box>
            </Grid>
        </Grid>
    </div>        
    );
};
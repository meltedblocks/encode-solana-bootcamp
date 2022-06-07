import React, { FC, useMemo } from "react";
import {  WalletAdapterNetwork, WalletNotConnectedError } from "@solana/wallet-adapter-base";
import { useAnchorWallet } from "@solana/wallet-adapter-react";
import { Connection, clusterApiUrl, SystemProgram, SYSVAR_RENT_PUBKEY } from "@solana/web3.js";
import { Program, AnchorProvider, web3, BN, utils, Wallet } from "@project-serum/anchor";
import { getOrCreateAssociatedTokenAccount, TOKEN_PROGRAM_ID } from "@solana/spl-token";

import idl from "../idl.json";
import { useSnackbar } from "notistack";
import { Box, Button, Grid, MenuItem, Select, TextField, Typography } from "@mui/material";
require("../App.css");

export const Create: FC = () => {

    const wallet = useAnchorWallet();
    const currentAccount = wallet?.publicKey;
    const network = WalletAdapterNetwork.Devnet;
    const { enqueueSnackbar } = useSnackbar();
    const endpoint = useMemo(() => clusterApiUrl(network), [network]);
    //const endpoint = "http://127.0.0.1:8899";    

    // async function getNFTs() {
    //     if(!currentAccount) {
    //         throw new WalletNotConnectedError();
    //     }
    //     let tokenData: any = []; 
    //     let accounts = await connection.getParsedTokenAccountsByOwner(
    //         currentAccount,
    //         {
    //             programId: TOKEN_PROGRAM_ID                
    //         }                        
    //     );        
    //     accounts.value.forEach((e) => {
    //         const token = e.account.data.parsed.info.tokenAmount;
    //         if(token.decimals == 0 && token.amount == 1) {
    //             tokenData.push(e.pubkey.toBase58());
    //             console.log(e.pubkey.toBase58());
    //         }
    //     });
    //     return tokenData;
    // }

    function getProvider() {
        const connection = new Connection(endpoint, "processed");
        if(!wallet) {
            throw new WalletNotConnectedError();
        }        
        const provider = new AnchorProvider(
            connection, wallet, {"preflightCommitment": "processed"}
        );
        return provider;
    }
 
    async function initializeLottery() {
        if (!currentAccount) {
            throw new WalletNotConnectedError();
        }

        try {
            const ownerTokenMint = "7tuNgpeoNiGLfKnwxbdNGXj5vvciPirYx9Z4kksT3GaV";
            const provider = getProvider();
            const program = new Program(idl as any, idl.metadata.address, provider as any);
            const [lotteryOwner] = await web3.PublicKey.findProgramAddress(
                [currentAccount?.toBytes(), utils.bytes.utf8.encode("lottery-owner-account")],
                program.programId
            );
            let lotteryStateAfterPlay = await program.account.lotteryOwner.fetchNullable(lotteryOwner);
            let count = lotteryStateAfterPlay!=null?lotteryStateAfterPlay.count:0;
            const [lottery] = await web3.PublicKey.findProgramAddress(
                [lotteryOwner.toBytes(), new BN(count).toArrayLike(Buffer, "le", 1), utils.bytes.utf8.encode("lottery")],
                program.programId
            );
            const [lotteryTokenAccount] = await web3.PublicKey.findProgramAddress(
                [lottery.toBytes(), utils.bytes.utf8.encode("lottery-token-account")],
                program.programId
            );
            const payer = wallet as Wallet;
            const mintPublicKey = new web3.PublicKey(ownerTokenMint);
            const ownerTokenAccount = await getOrCreateAssociatedTokenAccount(
                provider.connection,
                payer.payer,
                mintPublicKey,
                currentAccount
            );
            await program.methods.initializeLottery(new BN(1), new BN(0))
            .accounts({
              owner: currentAccount,
              lotteryOwner,
              ownerTokenAccount: ownerTokenAccount.address,
              ownerTokenMint,
              lottery,
              lotteryTokenAccount,
              rent: SYSVAR_RENT_PUBKEY,
              tokenProgram: TOKEN_PROGRAM_ID,
              systemProgram: SystemProgram.programId,
            }).rpc();
            enqueueSnackbar("NFT lottery created successfully", { variant: "success" });
        } catch (error: any) {
            enqueueSnackbar(error.message ? `${error.name}: ${error.message}` : error.name, { variant: "error" });
            console.log(error);
        }
    }

    async function withdrawLottery() {
        if (!currentAccount) {
            throw new WalletNotConnectedError();
        }

        try {
            const ownerTokenMint = "7tuNgpeoNiGLfKnwxbdNGXj5vvciPirYx9Z4kksT3GaV";
            const provider = getProvider();
            const program = new Program(idl as any, idl.metadata.address, provider as any);
            const [lotteryOwner] = await web3.PublicKey.findProgramAddress(
                [currentAccount?.toBytes(), utils.bytes.utf8.encode("lottery-owner-account")],
                program.programId
            );
            let lotteryStateAfterPlay = await program.account.lotteryOwner.fetchNullable(lotteryOwner);
            let count = lotteryStateAfterPlay!=null?lotteryStateAfterPlay.count:0;
            const [lottery] = await web3.PublicKey.findProgramAddress(
                [lotteryOwner.toBytes(), new BN(count-1).toArrayLike(Buffer, "le", 1), utils.bytes.utf8.encode("lottery")],
                program.programId
            );
            const [lotteryTokenAccount, lotteryBump] = await web3.PublicKey.findProgramAddress(
                [lottery.toBytes(), utils.bytes.utf8.encode("lottery-token-account")],
                program.programId
            );
            const payer = wallet as Wallet;
            const mintPublicKey = new web3.PublicKey(ownerTokenMint);
            const ownerTokenAccount = await getOrCreateAssociatedTokenAccount(
                provider.connection,
                payer.payer,
                mintPublicKey,
                currentAccount
            );            
            await program.methods.withdrawLottery(lotteryBump)
            .accounts({
              owner: currentAccount,
              ownerTokenAccount: ownerTokenAccount.address,
              lottery,
              lotteryTokenAccount,
              tokenProgram: TOKEN_PROGRAM_ID,
            }).rpc();
            enqueueSnackbar("NFT lottery withdrawn successfully", { variant: "success" });
        } catch (error: any) {
            enqueueSnackbar(error.message ? `${error.name}: ${error.message}` : error.name, { variant: "error" });
            console.log(error);
        }
    }

    return (        
        <div>
            <Grid container>
                <Grid item xs={6} md={6}>
                <Box
                display="flex"
                flexDirection="column"
                alignItems="center"
                alignContent="center"
                alignSelf="center"
                textAlign="center">
                    <Typography variant="h6" component="div" sx={{ color: "#ffffff", mt: "150px" }}>Choose a NFT to deposit</Typography>
                    <Select
                        value={10}
                        //onChange={handleChange}
                        sx={{ backgroundColor: "#0288d1", mt: "15px" }}>
                        <MenuItem value={10}>7tuNgpeoNiGLfKnwxbdNGXj5vvciPirYx9Z4kksT3GaV</MenuItem>
                    </Select>
                    <TextField sx={{ backgroundColor: "#0288d1", mt: "15px" }} label="Sol Amount" variant="filled" />
                    <Button variant="contained" sx={{ mt: "15px" }} onClick={initializeLottery}>Create Lottery</Button>
                </Box>
                </Grid>
                <Grid item xs={6} md={6}>
                <Box
                display="flex"
                flexDirection="column"
                alignItems="center"
                alignContent="center"
                alignSelf="center"
                textAlign="center">
                    <Typography variant="h6" component="div" sx={{ color: "#ffffff", mt: "150px" }}>Choose a NFT to withdraw</Typography>
                    <Select                        
                        value={10}
                        //onChange={handleChange}
                        sx={{ backgroundColor: "#0288d1", mt: "15px" }}>
                        <MenuItem value={10}>7tuNgpeoNiGLfKnwxbdNGXj5vvciPirYx9Z4kksT3GaV</MenuItem>
                    </Select>
                    <Button variant="contained" sx={{ mt: "15px" }} onClick={withdrawLottery}>Withdraw Lottery</Button>
                </Box>                  
                </Grid>
            </Grid>
        </div>
    );
};
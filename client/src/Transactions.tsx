import {  WalletAdapterNetwork, WalletNotConnectedError } from "@solana/wallet-adapter-base";
import { useAnchorWallet } from "@solana/wallet-adapter-react";
import { Connection, clusterApiUrl, SystemProgram, SYSVAR_RENT_PUBKEY } from "@solana/web3.js";
import { Program, AnchorProvider, web3, BN, utils, Wallet } from "@project-serum/anchor";
import { getOrCreateAssociatedTokenAccount, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import React, { FC, useMemo } from "react";
import idl from "./idl.json";

export const Transactions: FC = () => {

    const wallet = useAnchorWallet();
    const currentAccount = wallet?.publicKey;
    const network = WalletAdapterNetwork.Devnet;
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
    
 
    async function initializeLottery() {
        if (!currentAccount) {
            throw new WalletNotConnectedError();
        }
        const program = new Program(idl as any, idl.metadata.address, getProvider() as any);
        const [lotteryOwner] = await web3.PublicKey.findProgramAddress(
            [currentAccount?.toBytes(), utils.bytes.utf8.encode("lottery-owner-account")],
            program.programId
        );
        let lotteryStateAfterPlay = await program.account.lotteryOwner.fetch(lotteryOwner);
        let count = lotteryStateAfterPlay.count;        
        const [lottery] = await web3.PublicKey.findProgramAddress(
            [lotteryOwner.toBytes(), new BN(count).toArrayLike(Buffer, "le", 1), utils.bytes.utf8.encode("lottery")],
            program.programId
        );
        const [lotteryTokenAccount] = await web3.PublicKey.findProgramAddress(
            [lottery.toBytes(), utils.bytes.utf8.encode("lottery-token-account")],
            program.programId
        );
        const ownerTokenAccount = "CtDptEdWFC9hNtAjtSVkQvqL5RWsUDmoatESxj4fYpmE";
        const ownerTokenMint = "7tuNgpeoNiGLfKnwxbdNGXj5vvciPirYx9Z4kksT3GaV";
        try {
            await program.methods.initializeLottery(new BN(1), new BN(0))
            .accounts({
              owner: currentAccount,
              lotteryOwner,
              ownerTokenAccount,
              ownerTokenMint,
              lottery,
              lotteryTokenAccount,
              rent: SYSVAR_RENT_PUBKEY,
              tokenProgram: TOKEN_PROGRAM_ID,
              systemProgram: SystemProgram.programId,
            }).rpc();
        } catch (err) {
            console.log(err);
        }
    }

    async function withdrawLottery() {
        if (!currentAccount) {
            throw new WalletNotConnectedError();
        }
        const program = new Program(idl as any, idl.metadata.address, getProvider() as any);
        const [lotteryOwner] = await web3.PublicKey.findProgramAddress(
            [currentAccount?.toBytes(), utils.bytes.utf8.encode("lottery-owner-account")],
            program.programId
        );
        let lotteryStateAfterPlay = await program.account.lotteryOwner.fetch(lotteryOwner);
        let count = lotteryStateAfterPlay.count;        
        const [lottery] = await web3.PublicKey.findProgramAddress(
            [lotteryOwner.toBytes(), new BN(count-1).toArrayLike(Buffer, "le", 1), utils.bytes.utf8.encode("lottery")],
            program.programId
        );
        const [lotteryTokenAccount, lotteryBump] = await web3.PublicKey.findProgramAddress(
            [lottery.toBytes(), utils.bytes.utf8.encode("lottery-token-account")],
            program.programId
        );
        const ownerTokenAccount = "CtDptEdWFC9hNtAjtSVkQvqL5RWsUDmoatESxj4fYpmE";
        try {
            await program.methods.withdrawLottery(lotteryBump)
            .accounts({
              owner: currentAccount,
              ownerTokenAccount,
              lottery,
              lotteryTokenAccount,
              tokenProgram: TOKEN_PROGRAM_ID,
            }).rpc();
        } catch (err) {
            console.log(err);
        }
    }

    async function playLottery() {
        if (!currentAccount) {
            throw new WalletNotConnectedError();
        }
        const provider = getProvider();
        const program = new Program(idl as any, idl.metadata.address, provider as any);
        const [lotteryOwner] = await web3.PublicKey.findProgramAddress(
            [currentAccount?.toBytes(), utils.bytes.utf8.encode("lottery-owner-account")],
            program.programId
        );
        let lotteryStateAfterPlay = await program.account.lotteryOwner.fetch(lotteryOwner);
        let count = lotteryStateAfterPlay.count;
        const [lottery] = await web3.PublicKey.findProgramAddress(
            [lotteryOwner.toBytes(), new BN(count).toArrayLike(Buffer, "le", 1), utils.bytes.utf8.encode("lottery")],
            program.programId
        );
        const [lotteryTokenAccount, lotteryBump] = await web3.PublicKey.findProgramAddress(
            [lottery.toBytes(), utils.bytes.utf8.encode("lottery-token-account")],
            program.programId
        );
        const ownerTokenMint = "7tuNgpeoNiGLfKnwxbdNGXj5vvciPirYx9Z4kksT3GaV";
        let lotteryOwnerState = await program.account.lottery.fetch(lottery);        

        const payer = wallet as Wallet;
        
        const mintPublicKey = new web3.PublicKey(ownerTokenMint);
        console.log(payer);
        const playerTokenAccount= await getOrCreateAssociatedTokenAccount(
            provider.connection,
            payer.payer,
            mintPublicKey,
            currentAccount
        );
        
        try {
            await program.methods.playLottery(lotteryBump)
            .accounts({
              player: currentAccount,
              owner: lotteryOwnerState.owner,
              lottery,
              lotteryTokenAccount,
              ownerTokenMint,
              playerTokenAccount: playerTokenAccount.address,
              rent: SYSVAR_RENT_PUBKEY,
              tokenProgram: TOKEN_PROGRAM_ID,
              systemProgram: SystemProgram.programId,
            }).rpc();
        } catch (err) {
            console.log(err);
        }
    }    

    return (
        <div>
            <button onClick={initializeLottery}>Initialize Lottery</button>
            <button onClick={withdrawLottery}>Withdraw Lottery</button>            
            <button onClick={playLottery}>Play Lottery</button>
        </div>
    );
};
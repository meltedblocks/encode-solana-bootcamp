import * as anchor from "@project-serum/anchor";
import { utils, Program } from "@project-serum/anchor";
import { SystemProgram, SYSVAR_RENT_PUBKEY} from "@solana/web3.js";
import { FlipForNft } from "../target/types/flip_for_nft";
import { createMint, TOKEN_PROGRAM_ID, mintTo, createAssociatedTokenAccount, getAccount } from "@solana/spl-token";
import { expect } from "chai";

describe("flip-for-nft", () => {
  // Configure the client to use the local cluster.
  const provider = anchor.AnchorProvider.local();
  anchor.setProvider(anchor.AnchorProvider.env());

  const program = anchor.workspace.FlipForNft as Program<FlipForNft>;
  let testEnv: any = {};
  
  before(async () => {
		const LAMPORTS_PER_SOL = 1000000000;
    const owner = anchor.web3.Keypair.generate();
    const player = anchor.web3.Keypair.generate();
    const mintAuthority = anchor.web3.Keypair.generate();

    await provider.connection.confirmTransaction(
      await provider.connection.requestAirdrop(
        owner.publicKey,
        20 * LAMPORTS_PER_SOL
      )
    );

    await provider.connection.confirmTransaction(
      await provider.connection.requestAirdrop(
        player.publicKey,
        20 * LAMPORTS_PER_SOL
      )
    );

    const [lotteryOwner] = await anchor.web3.PublicKey.findProgramAddress(
      [owner.publicKey.toBytes(), utils.bytes.utf8.encode("lottery-owner-account")],
      program.programId
    );

    const [lottery] = await anchor.web3.PublicKey.findProgramAddress(
      [lotteryOwner.toBytes(), new anchor.BN(0).toArrayLike(Buffer, "le", 1), utils.bytes.utf8.encode("lottery")],
      program.programId
    );

    const [lotteryTokenAccount, lotteryBump] = await anchor.web3.PublicKey.findProgramAddress(
      [lottery.toBytes(), utils.bytes.utf8.encode("lottery-token-account")],
      program.programId
    );

    let ownerTokenMint = await createMint(
      provider.connection,
      owner,
      mintAuthority.publicKey,
      null,
      0
    );

    const ownerTokenAccount = await createAssociatedTokenAccount(
      provider.connection,
      owner,
      ownerTokenMint,
      owner.publicKey,
    );

    const playerTokenAccount= await createAssociatedTokenAccount(
      provider.connection,
      player,
      ownerTokenMint,
      player.publicKey,
    );

    await mintTo(
      provider.connection,
      owner,
      ownerTokenMint,
      ownerTokenAccount,
      mintAuthority,
      1,
    );

    testEnv = {owner, lotteryOwner, lottery, ownerTokenMint, lotteryTokenAccount, ownerTokenAccount, playerTokenAccount, player, lotteryBump};

	});

  it("Initialize Lottery", async () => {
    let {owner, lotteryOwner, lottery, ownerTokenMint, lotteryTokenAccount, ownerTokenAccount} =  testEnv;
    await program.methods.initializeLottery(new anchor.BN(100))
    .accounts({
      owner: owner.publicKey,
      lotteryOwner,
      ownerTokenAccount,
      ownerTokenMint,
      lottery,
      lotteryTokenAccount,
      rent: SYSVAR_RENT_PUBKEY,
      tokenProgram: TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
    })
    .signers([owner])
    .rpc();
    let lotteryTokenAccountState = await await getAccount(provider.connection, lotteryTokenAccount);
    let ownerTokenAccountState = await getAccount(provider.connection, ownerTokenAccount);
    let lotteryState = await program.account.lottery.fetch(lottery);
    let lotteryOwnerState = await program.account.lotteryOwner.fetch(lotteryOwner);
    expect(ownerTokenAccountState.amount.toString()).equal("0");
    expect(lotteryTokenAccountState.amount.toString()).equal("1");
    expect(lotteryState.amount.toNumber()).equal(100);
    expect(lotteryState.isWinner).equal(false);
    expect(lotteryState.creationDate.toNumber()).lessThanOrEqual(Date.now());
    expect(lotteryOwnerState.count).equal(1);
  });

  it("Withdraw Lottery", async () => {
    let {owner, lotteryOwner, lottery, ownerTokenMint, lotteryTokenAccount, ownerTokenAccount, lotteryBump} =  testEnv;
    await program.methods.withdrawLottery(lotteryBump)
    .accounts({
      owner: owner.publicKey,
      ownerTokenAccount,
      lottery,
      lotteryTokenAccount,
      tokenProgram: TOKEN_PROGRAM_ID,
    })
    .signers([owner])
    .rpc();
    let lotteryTokenAccountState = await await getAccount(provider.connection, lotteryTokenAccount);
    let ownerTokenAccountState = await getAccount(provider.connection, ownerTokenAccount);
    expect(ownerTokenAccountState.amount.toString()).equal("1");
    expect(lotteryTokenAccountState.amount.toString()).equal("0");
  });

  it("Re-Initialize Lottery after withdraw", async () => {
    let {owner, lotteryOwner, lottery, ownerTokenMint, lotteryTokenAccount, ownerTokenAccount, lotteryBump} =  testEnv;
    [lottery] = await anchor.web3.PublicKey.findProgramAddress(
      [lotteryOwner.toBytes(), new anchor.BN(1).toArrayLike(Buffer, "le", 1), utils.bytes.utf8.encode("lottery")],
      program.programId
    );
    [lotteryTokenAccount, lotteryBump] = await anchor.web3.PublicKey.findProgramAddress(
      [lottery.toBytes(), utils.bytes.utf8.encode("lottery-token-account")],
      program.programId
    );
    await program.methods.initializeLottery(new anchor.BN(100))
    .accounts({
      owner: owner.publicKey,
      lotteryOwner,
      ownerTokenAccount,
      ownerTokenMint,
      lottery,
      lotteryTokenAccount,
      rent: SYSVAR_RENT_PUBKEY,
      tokenProgram: TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
    })
    .signers([owner])
    .rpc();
    let lotteryTokenAccountState = await await getAccount(provider.connection, lotteryTokenAccount);
    let ownerTokenAccountState = await getAccount(provider.connection, ownerTokenAccount);
    let lotteryState = await program.account.lottery.fetch(lottery);
    let lotteryOwnerState = await program.account.lotteryOwner.fetch(lotteryOwner);
    expect(ownerTokenAccountState.amount.toString()).equal("0");
    expect(lotteryTokenAccountState.amount.toString()).equal("1");
    expect(lotteryState.amount.toNumber()).equal(100);
    expect(lotteryState.isWinner).equal(false);
    expect(lotteryState.creationDate.toNumber()).lessThanOrEqual(Date.now());
    expect(lotteryOwnerState.count).equal(2);
    testEnv = {...testEnv, lottery, lotteryTokenAccount};
  });

  it("Play Lottery", async () => {
    let {owner, lottery, ownerTokenMint, lotteryTokenAccount, playerTokenAccount, player, lotteryBump} =  testEnv;
    let preBalanaceOwner = await provider.connection.getBalance(
      owner.publicKey
    );
    await program.methods.playLottery(new anchor.BN(0), lotteryBump)
    .accounts({
      player: player.publicKey,
      owner: owner.publicKey,
      lottery,
      lotteryTokenAccount,
      ownerTokenMint,
      playerTokenAccount,
      rent: SYSVAR_RENT_PUBKEY,
      tokenProgram: TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
    })
    .signers([player])
    .rpc();
    let lotteryStateAfterPlay = await program.account.lottery.fetch(lottery);
    let postBalanaceOwner = await provider.connection.getBalance(
      owner.publicKey
    );
    let playerTokenAccountState = await await getAccount(provider.connection, playerTokenAccount);
    if (lotteryStateAfterPlay.isWinner) {
      expect(playerTokenAccountState.amount.toString()).equal("1");
    } else {
      let balanceDiff = postBalanaceOwner - preBalanaceOwner;
      expect(balanceDiff).equal(100);
    }
  });

});

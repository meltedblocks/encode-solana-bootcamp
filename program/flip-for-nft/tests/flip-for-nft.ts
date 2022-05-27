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

  it("Initialize Lottery", async () => {
    const LAMPORTS_PER_SOL = 1000000000;
    const owner = anchor.web3.Keypair.generate();
    const mint_authority = anchor.web3.Keypair.generate();

    await provider.connection.confirmTransaction(
      await provider.connection.requestAirdrop(
        owner.publicKey,
        20 * LAMPORTS_PER_SOL
      )
    );

    const [lotteryOwner] = await anchor.web3.PublicKey.findProgramAddress(
      [owner.publicKey.toBytes(), utils.bytes.utf8.encode("lottery-owner-account")],
      program.programId
    );

    const [lottery] = await anchor.web3.PublicKey.findProgramAddress(
      [utils.bytes.utf8.encode("lottery")],
      program.programId
    );

    const [lotteryTokenAccount] = await anchor.web3.PublicKey.findProgramAddress(
      [utils.bytes.utf8.encode("lottery-token-account")],
      program.programId
    );

    let ownerTokenMint = await createMint(
      provider.connection,
      owner,
      mint_authority.publicKey,
      null,
      0
    );

    const ownerTokenAccount = await createAssociatedTokenAccount(
      provider.connection,
      owner,
      ownerTokenMint,
      owner.publicKey,
    );

    await mintTo(
      provider.connection,
      owner,
      ownerTokenMint,
      ownerTokenAccount,
      mint_authority,
      1,
    );

    await program.methods.initializeLottery(new anchor.BN(0), new anchor.BN(100))
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
    let lotteryTokenAccountState = await getAccount(provider.connection, lotteryTokenAccount);
    let ownerTokenAccountState = await getAccount(provider.connection, ownerTokenAccount);
    let lotteryState = await program.account.lottery.fetch(lottery);
    let lotteryOwnerState = await program.account.lotteryOwner.fetch(lotteryOwner);
    expect(ownerTokenAccountState.amount.toString()).equal("0");
    expect(lotteryTokenAccountState.amount.toString()).equal("1");
    expect(lotteryState.amount.toNumber()).equal(100);
    expect(lotteryState.creationDate.toNumber()).lessThanOrEqual(Date.now());
    expect(lotteryOwnerState.count).equal(1);
  });
});

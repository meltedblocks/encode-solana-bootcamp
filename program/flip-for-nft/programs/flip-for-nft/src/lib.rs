use anchor_lang::prelude::*;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token::{Mint, Token, TokenAccount, Transfer};
use std::mem::size_of;

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");
#[error_code]
pub enum LotteryError {
    #[msg("Wrong owner")]
    WrongOwner,
    #[msg("Wrong amount")]
    WrongAmount,
    #[msg("Mint is not matching token account")]
    MismatchingMint,
    #[msg("Supply has to be 1")]
    IncorrectSupply,
    #[msg("Incorrect Counter")]
    IncorrectCounter,
}

pub const LOTTERY_OWNER_ACCOUNT_SEED: &str = "lottery-owner-account";
pub const LOTTERY_TOKEN_ACCOUNT_SEED: &str = "lottery-token-account";
pub const LOTTERY_ACCOUNT_SEED: &str = "lottery";

#[program]
pub mod flip_for_nft {
    use super::*;

    pub fn initialize_lottery(ctx: Context<Initialize>, counter: u8, amount: u64) -> Result<()> {
        let lottery_owner: &mut Account<LotteryOwner> = &mut ctx.accounts.lottery_owner;
        let lottery: &mut Account<Lottery> = &mut ctx.accounts.lottery;
        lottery_owner.count += 1;
        lottery.amount = amount;
        lottery.creation_date = Clock::get().unwrap().unix_timestamp;
        let transfer_instruction = Transfer {
            from: ctx.accounts.owner_token_account.to_account_info(),
            to: ctx.accounts.lottery_token_account.to_account_info(),
            authority: ctx.accounts.owner.to_account_info(),
        };
        let cpi_ctx = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            transfer_instruction,
            &[],
        );

        anchor_spl::token::transfer(cpi_ctx, 1)?;
        Ok(())
    }
}

#[derive(Accounts)]
#[instruction(counter: u8)]
pub struct Initialize<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,
    #[account(
        init_if_needed,
        seeds = [owner.key().as_ref(), LOTTERY_OWNER_ACCOUNT_SEED.as_bytes()],
        constraint = lottery_owner.count == counter @ LotteryError::IncorrectCounter,
        bump,
        payer = owner,
        space = 2 * size_of::<LotteryOwner>() + 8,
    )]
    pub lottery_owner: Box<Account<'info, LotteryOwner>>,
    #[account(
        mut,
        constraint = owner_token_account.owner == owner.key() @ LotteryError::WrongOwner,
        constraint = owner_token_account.amount == 1 @ LotteryError::WrongAmount,
        constraint = owner_token_account.mint == owner_token_mint.key() @ LotteryError::MismatchingMint
    )]
    pub owner_token_account: Box<Account<'info, TokenAccount>>,
    #[account(mut,
        constraint = owner_token_mint.supply == 1 @ LotteryError::IncorrectSupply
    )]
    pub owner_token_mint: Box<Account<'info, Mint>>,
    #[account(
        init,
        seeds = [LOTTERY_ACCOUNT_SEED.as_bytes()],
        bump,
        payer = owner,
        space = 2 * size_of::<Lottery>() + 8,
    )]
    pub lottery: Box<Account<'info, Lottery>>,
    #[account(
        init,
        seeds = [LOTTERY_TOKEN_ACCOUNT_SEED.as_bytes()],
        bump,
        payer = owner,
        token::mint = owner_token_mint,
        token::authority = owner
    )]
    pub lottery_token_account: Box<Account<'info, TokenAccount>>,
    pub rent: Sysvar<'info, Rent>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[account]
pub struct Lottery {
    // amount how much user should stake to take part in lottery for NFT
    pub amount: u64,
    // timestamp of lottery creation date
    pub creation_date: i64,
}

#[account]
pub struct LotteryOwner {
    // keep count to easily get all loteries for current owner
    pub count: u8,
}

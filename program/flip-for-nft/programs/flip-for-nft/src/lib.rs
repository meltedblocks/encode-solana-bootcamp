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
    #[msg("Lottery is already won")]
    WinnerAlready,
    #[msg("Incorrect mint")]
    IncorrectMint,
    #[msg("Incorrect bet")]
    IncorrectBet,
    #[msg("Lose")]
    Lose,
    #[msg("Incorrect owner")]
    IncorrectOwner,
}

pub const LOTTERY_OWNER_ACCOUNT_SEED: &str = "lottery-owner-account";
pub const LOTTERY_TOKEN_ACCOUNT_SEED: &str = "lottery-token-account";
pub const LOTTERY_ACCOUNT_SEED: &str = "lottery";

#[program]
pub mod flip_for_nft {
    use super::*;

    pub fn initialize_lottery(
        ctx: Context<Initialize>,
        counter: u8,
        amount: u64,
        bet: u8,
    ) -> Result<()> {
        if bet != 0 && bet != 1 {
            return Err(LotteryError::IncorrectBet.into());
        }

        let lottery_owner: &mut Account<LotteryOwner> = &mut ctx.accounts.lottery_owner;
        let lottery: &mut Account<Lottery> = &mut ctx.accounts.lottery;
        lottery_owner.count += 1;
        lottery.amount = amount;
        lottery.is_winner = false;
        lottery.creation_date = Clock::get().unwrap().unix_timestamp;
        lottery.mint = ctx.accounts.owner_token_mint.key();
        lottery.bet = bet;
        lottery.owner = ctx.accounts.owner.key();
        lottery.amount_won = 0;
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

    pub fn play_lottery(ctx: Context<Play>, bump: u8) -> Result<()> {
        let lottery: &mut Account<Lottery> = &mut ctx.accounts.lottery;
        //do lottery
        let mut now_ts = Clock::get().unwrap().unix_timestamp;

        let mask =
            0b0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0001;

        now_ts = now_ts & mask;

        let player: &mut Signer = &mut ctx.accounts.player;

        if now_ts as u8 == lottery.bet {
            msg!("You loose");
            lottery.amount_won += lottery.amount;
            let ix = anchor_lang::solana_program::system_instruction::transfer(
                &player.key(),
                &ctx.accounts.owner.key(),
                lottery.amount,
            );
            anchor_lang::solana_program::program::invoke(
                &ix,
                &[
                    player.to_account_info(),
                    ctx.accounts.owner.to_account_info(),
                ],
            )?;
            return Ok(());
        }

        msg!("You won");
        lottery.is_winner = true;
        let transfer_instruction = Transfer {
            from: ctx.accounts.lottery_token_account.to_account_info(),
            to: ctx.accounts.player_token_account.to_account_info(),
            authority: ctx.accounts.lottery_token_account.to_account_info(),
        };
        let lottery_key = ctx.accounts.lottery.key();
        let seeds = &[
            lottery_key.as_ref(),
            LOTTERY_TOKEN_ACCOUNT_SEED.as_bytes(),
            &[bump],
        ];
        anchor_spl::token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                transfer_instruction,
                &[seeds],
            ),
            1,
        )
        .unwrap();

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
        seeds = [lottery_owner.key().as_ref(), counter.to_le_bytes().as_ref(), LOTTERY_ACCOUNT_SEED.as_bytes()],
        bump,
        payer = owner,
        space = 2 * size_of::<Lottery>() + 8,
    )]
    pub lottery: Box<Account<'info, Lottery>>,
    #[account(
        init,
        seeds = [lottery.key().as_ref(), LOTTERY_TOKEN_ACCOUNT_SEED.as_bytes()],
        bump,
        payer = owner,
        token::mint = owner_token_mint,
        token::authority = lottery_token_account
    )]
    pub lottery_token_account: Box<Account<'info, TokenAccount>>,
    pub rent: Sysvar<'info, Rent>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Play<'info> {
    #[account(mut,
        constraint = player.to_account_info().lamports() >= lottery.amount,
    )]
    pub player: Signer<'info>,
    /// CHECK: validated via constrain
    #[account(mut,
        constraint = owner.key() == lottery.owner @ LotteryError::IncorrectOwner
    )]
    pub owner: AccountInfo<'info>,
    #[account(mut,
        constraint = !lottery.is_winner @ LotteryError::WinnerAlready
    )]
    pub lottery: Box<Account<'info, Lottery>>,
    #[account(mut,
        seeds = [lottery.key().as_ref(), LOTTERY_TOKEN_ACCOUNT_SEED.as_bytes()],
        bump
    )]
    pub lottery_token_account: Box<Account<'info, TokenAccount>>,
    #[account(mut,
        constraint = lottery_token_account.mint == owner_token_mint.key() @ LotteryError::IncorrectMint
    )]
    pub owner_token_mint: Box<Account<'info, Mint>>,
    #[account(
        init_if_needed,
        payer = player,
        associated_token::mint = owner_token_mint,
        associated_token::authority = player
    )]
    pub player_token_account: Box<Account<'info, TokenAccount>>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub rent: Sysvar<'info, Rent>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[account]
pub struct Lottery {
    // amount how much user should stake to take part in lottery for NFT
    pub amount: u64,
    // amount already won by user
    pub amount_won: u64,
    // timestamp of lottery creation date
    pub creation_date: i64,
    // 0 or 1 creator can bet which is winning
    pub bet: u8,

    pub mint: Pubkey,

    pub owner: Pubkey,

    pub is_winner: bool,
}

#[account]
pub struct LotteryOwner {
    // keep count to easily get all loteries for current owner
    pub count: u8,
}

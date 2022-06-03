use anchor_lang::{prelude::*, AccountsClose};
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token::Transfer;
use anchor_spl::token::{Mint, Token, TokenAccount};
use std::mem::size_of;

mod constants;
mod errors;
mod states;
mod util;

use crate::constants::{
    LOTTERY_ACCOUNT_SEED, LOTTERY_OWNER_ACCOUNT_SEED, LOTTERY_TOKEN_ACCOUNT_SEED,
};
use crate::errors::LotteryError;
use crate::states::{Lottery, LotteryOwner};
use crate::util::do_lottery;

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod flip_for_nft {
    use super::*;

    pub fn initialize_lottery(ctx: Context<Initialize>, amount: u64) -> Result<()> {
        let lottery_owner: &mut Account<LotteryOwner> = &mut ctx.accounts.lottery_owner;
        let lottery: &mut Account<Lottery> = &mut ctx.accounts.lottery;
        lottery_owner.count += 1;
        lottery.amount = amount;
        lottery.is_winner = false;
        lottery.creation_date = Clock::get().unwrap().unix_timestamp;
        lottery.mint = ctx.accounts.owner_token_mint.key();
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

    pub fn play_lottery(ctx: Context<Play>, bet: u8, bump: u8) -> Result<()> {
        let lottery: &mut Account<Lottery> = &mut ctx.accounts.lottery;
        if bet != 0 && bet != 1 {
            return Err(LotteryError::IncorrectBet.into());
        }

        let lottery_result = do_lottery();

        let player: &mut Signer = &mut ctx.accounts.player;

        if lottery_result != bet {
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

    pub fn withdraw_lottery(ctx: Context<Withdraw>, bump: u8) -> Result<()> {
        let transfer_instruction = Transfer {
            from: ctx.accounts.lottery_token_account.to_account_info(),
            to: ctx.accounts.owner_token_account.to_account_info(),
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

        ctx.accounts
            .lottery
            .close(ctx.accounts.owner.to_account_info())?;

        Ok(())
    }

    #[derive(Accounts)]
    pub struct Initialize<'info> {
        #[account(mut)]
        pub owner: Signer<'info>,
        #[account(
        init_if_needed,
        seeds = [owner.key().as_ref(), LOTTERY_OWNER_ACCOUNT_SEED.as_bytes()],
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
        seeds = [lottery_owner.key().as_ref(), lottery_owner.count.to_le_bytes().as_ref(), LOTTERY_ACCOUNT_SEED.as_bytes()],
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

    #[derive(Accounts)]
    #[instruction(counter: u8)]
    pub struct Withdraw<'info> {
        #[account(mut,
            constraint = owner.key() == lottery.owner @ LotteryError::IncorrectOwner
        )]
        pub owner: Signer<'info>,
        #[account(
        mut,
        constraint = owner_token_account.owner == owner.key() @ LotteryError::WrongOwner,
        constraint = owner_token_account.amount == 0 @ LotteryError::WrongAmount,
        constraint = owner_token_account.mint == lottery_token_account.mint.key() @ LotteryError::MismatchingMint
    )]
        pub owner_token_account: Box<Account<'info, TokenAccount>>,
        #[account(mut,
            constraint = !lottery.is_winner @ LotteryError::WinnerAlready,
        )]
        pub lottery: Box<Account<'info, Lottery>>,
        #[account(mut,
            seeds = [lottery.key().as_ref(), LOTTERY_TOKEN_ACCOUNT_SEED.as_bytes()],
            bump
        )]
        pub lottery_token_account: Box<Account<'info, TokenAccount>>,
        pub token_program: Program<'info, Token>,
        pub system_program: Program<'info, System>,
    }
}

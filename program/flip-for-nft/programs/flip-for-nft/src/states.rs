use anchor_lang::prelude::*;

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
    // NFT mint
    pub mint: Pubkey,
    // Lottery owner
    pub owner: Pubkey,
    // True if there is already winner
    pub is_winner: bool,
}

#[account]
pub struct LotteryOwner {
    // keep count to easily get all loteries for current owner
    pub count: u8,
}

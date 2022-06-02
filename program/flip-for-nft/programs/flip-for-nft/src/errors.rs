use anchor_lang::error_code;

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

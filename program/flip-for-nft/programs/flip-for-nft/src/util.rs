use anchor_lang::prelude::*;
pub fn do_lottery() -> u8 {
    let now_ts = Clock::get().unwrap().unix_timestamp;

    let mask = 0b0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0001;

    let result = now_ts & mask;

    result as u8
}

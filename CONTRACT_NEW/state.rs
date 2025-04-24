use anchor_lang::prelude::*;
// use crate::IcoStatus;

#[account]
#[derive(InitSpace)]
pub struct IcoState {
    pub authority: Pubkey,      // 32
    pub token_mint: Pubkey,     // 32
    pub vault: Pubkey,          // 32
    pub token_price: u64,       // 8
    pub total_contributed: u64, // 8
    pub start_date: i64,
    pub end_date: i64,
    pub token_amount: u64,
    pub soft_cap: u64,
    pub hard_cap: u64,
}

#[account]
#[derive(InitSpace)]
pub struct Contribution {
    pub user: Pubkey, // 32
    pub ico_state: Pubkey,
    pub amount: u64, // 8
}

#[account]
#[derive(InitSpace)]
pub struct IcoStatusAccount {
    pub status: u8, // Use u8 to represent enum variants
    pub authority: Pubkey,
}

use anchor_lang::prelude::*;
use anchor_spl::token::{Mint, Token, TokenAccount};
use crate::state::{Contribution, IcoState};

#[derive(Accounts)]
pub struct InitializeIco<'info> {
    #[account(
        init_if_needed,
        payer = authority,
        space = 8 + IcoState::INIT_SPACE,
        seeds = [b"ico-state-new", token_mint.key().as_ref()],
        bump
    )]
    pub ico_state: Account<'info, IcoState>,

    #[account(mut)]
    pub user_token_account: Account<'info, TokenAccount>,

    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(mut)]
    pub token_mint: Account<'info, Mint>,

    #[account(mut)]
    pub vault: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct WithdrawSol<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        mut,
        seeds = [b"ico-state-new", ico_state.token_mint.as_ref()],
        bump,
        has_one = authority
    )]
    pub ico_state: Account<'info, IcoState>,
}

#[derive(Accounts)]
pub struct Contribute<'info> {
    #[account(mut)]
    pub user: Signer<'info>,

    #[account(mut)]
    pub ico_state: Account<'info, IcoState>,

    #[account(
        init_if_needed,
        payer = user,
        space = 8 + Contribution::INIT_SPACE,
        seeds = [b"contribution", user.key().as_ref()],
        bump
    )]
    pub contribution: Account<'info, Contribution>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ClaimTokens<'info> {
    #[account(mut)]
    pub user: Signer<'info>,

    #[account(
       mut,
        seeds = [b"ico-state-new", ico_state.token_mint.as_ref()],
        bump,
    )]
    pub ico_state: Account<'info, IcoState>,

    #[account(mut)]
    pub contribution: Account<'info, Contribution>,

    #[account(mut)]
    pub vault_token_account: Account<'info, TokenAccount>,

    #[account(mut)]
    pub user_token_account: Account<'info, TokenAccount>,

    #[account(mut)]
    pub token_mint: Account<'info, Mint>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UpdateIcoStatus<'info> {
    #[account(mut, has_one = authority)]
    pub ico_state: Account<'info, IcoState>,
    pub authority: Signer<'info>,
}

#[derive(Accounts)]
pub struct Refund<'info> {
    #[account(
       mut,
        seeds = [b"ico-state-new", ico_state.token_mint.as_ref()],
        bump,
    )]
    pub ico_state: Account<'info, IcoState>,

    #[account(mut, has_one = user)]
    pub contribution: Account<'info, Contribution>,

    #[account(mut)]
    pub user: Signer<'info>,

    pub system_program: Program<'info, System>,
}

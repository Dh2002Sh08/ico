use anchor_lang::prelude::*;
use anchor_spl::token::{Mint, Token, TokenAccount};

declare_id!("AyScmNYVgSya8qzk8xXSqsvJjfnwxBv3wHLT6165aLN4");

#[program]
pub mod ico_project {
    use super::*;

    pub fn initialize_ico(
        ctx: Context<InitializeIco>,
        token_price_lamports: u64,
        start_date: i64,
        end_date: i64,
        token_amount: u64,
    ) -> Result<()> {
        let ico_state = &mut ctx.accounts.ico_state;

        ico_state.authority = ctx.accounts.authority.key();
        ico_state.token_mint = ctx.accounts.token_mint.key();
        ico_state.vault = ctx.accounts.vault.key();
        ico_state.token_price = token_price_lamports;
        ico_state.total_contributed = 0;
        ico_state.start_date = start_date;
        ico_state.end_date = end_date;
        ico_state.token_amount = token_amount;

        // Transfer initial tokens to the vault

        let destination = &ctx.accounts.vault;
        let source = &ctx.accounts.user_token_account;
        let token_program = &ctx.accounts.token_program;
        let authority = &ctx.accounts.authority;

        let cpi_accounts = anchor_spl::token::Transfer {
            from: source.to_account_info().clone(),
            to: destination.to_account_info().clone(),
            authority: authority.to_account_info().clone(),
        };
        let cpi_program = token_program.to_account_info();

        anchor_spl::token::transfer(CpiContext::new(cpi_program, cpi_accounts), token_amount)?;

        Ok(())
    }

    pub fn contribute(ctx: Context<Contribute>, amount: u64) -> Result<()> {
        let clock = Clock::get()?;
        let current_time = clock.unix_timestamp;

        let start = ctx.accounts.ico_state.start_date;
        let end = ctx.accounts.ico_state.end_date;

        require!(
            current_time >= start && current_time <= end,
            IcoError::InvalidContributionTime
        );

        const MIN_CONTRIBUTION: u64 = 100_000; // 0.0001 SOL = 100_000 lamports
        const MAX_CONTRIBUTION: u64 = 4_500_000_000; // 4.5 SOL = 4_500_000_000 lamports

        require!(
            amount >= MIN_CONTRIBUTION,
            IcoError::BelowMinimumContribution
        );

        let new_total = ctx
            .accounts
            .contribution
            .amount
            .checked_add(amount)
            .ok_or(IcoError::Overflow)?;

        require!(
            new_total <= MAX_CONTRIBUTION,
            IcoError::AboveMaximumContribution
        );
        // Transfer SOL from user to ICO state account
        let ix = anchor_lang::solana_program::system_instruction::transfer(
            &ctx.accounts.user.key(),
            &ctx.accounts.ico_state.key(),
            amount,
        );

        anchor_lang::solana_program::program::invoke(
            &ix,
            &[
                ctx.accounts.user.to_account_info(),
                ctx.accounts.ico_state.to_account_info(),
            ],
        )?;

        // Update user's contribution record
        let contribution = &mut ctx.accounts.contribution;
        contribution.user = ctx.accounts.user.key();
        contribution.amount = contribution
            .amount
            .checked_add(amount)
            .ok_or(IcoError::Overflow)?;

        // Update ICO state
        let ico_state = &mut ctx.accounts.ico_state;

        ico_state.total_contributed = ico_state
            .total_contributed
            .checked_add(amount)
            .ok_or(IcoError::Overflow)?;

        Ok(())
    }

    pub fn claim_tokens(ctx: Context<ClaimTokens>) -> Result<()> {
        let contribution = &mut ctx.accounts.contribution;
        let ico_state = &ctx.accounts.ico_state;

        let clock = Clock::get()?;
        let now = clock.unix_timestamp;

        require!(now >= ico_state.end_date, IcoError::IcoNotEndedYet);

        // Ensure user has something to claim
        require!(contribution.amount > 0, IcoError::NothingToClaim);

        let token_decimals = ctx.accounts.token_mint.decimals;
        // Calculate tokens to send based on price
        let tokens_to_send = contribution
            .amount
            .checked_mul(10u64.pow(token_decimals as u32))
            .ok_or(IcoError::MathOverflow)?
            .checked_div(ico_state.token_price)
            .ok_or(IcoError::InvalidPrice)?;

        // Derive signer seeds using correct bump access
        let bump = ctx.bumps.ico_state;
        let token_mint = ico_state.token_mint.key();
        let seeds: &[&[u8]] = &[b"ico-state", token_mint.as_ref(), &[bump]];
        let signer_seeds: &[&[&[u8]]] = &[seeds];

        // Transfer tokens to the user
        let cpi_accounts = anchor_spl::token::Transfer {
            from: ctx.accounts.vault_token_account.to_account_info(),
            to: ctx.accounts.user_token_account.to_account_info(),
            authority: ico_state.to_account_info(),
        };

        let cpi_program = ctx.accounts.token_program.to_account_info();

        anchor_spl::token::transfer(
            CpiContext::new_with_signer(cpi_program, cpi_accounts, signer_seeds),
            tokens_to_send,
        )?;

        // Reset contribution
        contribution.amount = 0;

        Ok(())
    }

    pub fn withdraw_sol(ctx: Context<WithdrawSol>) -> Result<()> {
        let ico_state = &mut ctx.accounts.ico_state;

        let clock = Clock::get()?;
        let now = clock.unix_timestamp;

        require!(now >= ico_state.end_date, IcoError::IcoNotEndedYet);

        require_keys_eq!(
            ctx.accounts.authority.key(),
            ico_state.authority,
            IcoError::Unauthorized
        );

        let lamports = ctx.accounts.ico_state.to_account_info().lamports();

        **ctx
            .accounts
            .ico_state
            .to_account_info()
            .try_borrow_mut_lamports()? -= lamports;
        **ctx
            .accounts
            .authority
            .to_account_info()
            .try_borrow_mut_lamports()? += lamports;

        Ok(())
    }

}

#[derive(Accounts)]
pub struct InitializeIco<'info> {
    #[account(
        init_if_needed,
        payer = authority,
        space = 8 + IcoState::INIT_SPACE,
        seeds = [b"ico-state", token_mint.key().as_ref()],
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
        seeds = [b"ico-state", ico_state.token_mint.as_ref()],
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
        seeds = [b"ico-state", ico_state.token_mint.as_ref()],
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
}

#[account]
#[derive(InitSpace)]
pub struct Contribution {
    pub user: Pubkey, // 32
    pub amount: u64,  // 8
}

#[error_code]
pub enum IcoError {
    #[msg("Invalid PDA signer.")]
    InvalidSigner,
    #[msg("Invalid mint configuration.")]
    InvalidMint,
    #[msg("Invalid vault owner.")]
    InvalidVaultOwner,
    #[msg("Invalid vault mint.")]
    InvalidVaultMint,
    #[msg("Arithmetic overflow.")]
    Overflow,
    #[msg("Nothing to claim.")]
    NothingToClaim,
    #[msg("Invalid Price")]
    InvalidPrice,
    #[msg("Invalid Account")]
    InvalidTokenAccount,
    #[msg("Invalid Contribution")]
    InvalidContribution,
    #[msg("Unauthorized: Only ICO creator can withdraw")]
    Unauthorized,
    #[msg("Mathematics logic fails")]
    MathOverflow,
    #[msg("Contributions are only allowed during the ICO period.")]
    InvalidContributionTime,
    #[msg("Wait for ICO to be ended")]
    IcoNotEndedYet,
    #[msg("Contribution is below the minimum allowed (0.0001 SOL).")]
    BelowMinimumContribution,
    #[msg("Contribution exceeds the maximum allowed per wallet (4.5 SOL).")]
    AboveMaximumContribution,
}

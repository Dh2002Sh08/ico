use anchor_lang::prelude::*;
use anchor_spl::token::{Mint, SetAuthority, Token, TokenAccount, Transfer};

declare_id!("AyScmNYVgSya8qzk8xXSqsvJjfnwxBv3wHLT6165aLN4");

#[program]
pub mod ico_project {
    use super::*;

    pub fn initialize_ico(ctx: Context<InitializeIco>, token_price_lamports: u64) -> Result<()> {
        let ico_state = &mut ctx.accounts.ico_state;

        ico_state.authority = ctx.accounts.authority.key();
        ico_state.token_mint = ctx.accounts.token_mint.key();
        ico_state.vault = ctx.accounts.vault.key();
        ico_state.token_price = token_price_lamports;
        ico_state.total_contributed = 0;

        Ok(())
    }

    pub fn contribute(ctx: Context<Contribute>, amount: u64) -> Result<()> {
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

        // Ensure user has something to claim
        require!(contribution.amount > 0, IcoError::NothingToClaim);

        // Calculate tokens to send based on price
        let tokens_to_send = contribution
            .amount
            .checked_div(ico_state.token_price)
            .ok_or(IcoError::InvalidPrice)?;

        // Transfer tokens from vault to user
        let cpi_accounts = Transfer {
            from: ctx.accounts.vault.to_account_info(),
            to: ctx.accounts.destination.to_account_info(),
            authority: ctx.accounts.owner.to_account_info(), // now a wallet, not PDA
        };

        anchor_spl::token::transfer(
            CpiContext::new(ctx.accounts.token_program.to_account_info(), cpi_accounts),
            tokens_to_send,
        )?;

        // Reset contribution
        contribution.amount = 0;

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
    pub authority: Signer<'info>,

    #[account(mut)]
    pub token_mint: Account<'info, Mint>,

    #[account(mut)]
    pub vault: Account<'info, TokenAccount>,

    /// CHECK: PDA verified manually
    pub ico_signer: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub rent: Sysvar<'info, Rent>,
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

    #[account(mut)]
    pub contribution: Account<'info, Contribution>,

    #[account(mut)]
    pub ico_state: Account<'info, IcoState>,

    #[account(mut)]
    pub vault: Account<'info, TokenAccount>,

    #[account(mut)]
    pub destination: Account<'info, TokenAccount>,

    /// CHECK: This is the regular wallet that owns the vault
    pub owner: AccountInfo<'info>,

    pub token_program: Program<'info, Token>,
}

#[account]
#[derive(InitSpace)]
pub struct IcoState {
    pub authority: Pubkey,      // 32
    pub token_mint: Pubkey,     // 32
    pub vault: Pubkey,          // 32
    pub token_price: u64,       // 8
    pub total_contributed: u64, // 8
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
}

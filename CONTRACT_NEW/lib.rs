use anchor_lang::prelude::*;
use anchor_lang::solana_program::program_pack::Pack;
use spl_token::state::Mint;

pub mod error;
pub mod instructions;
pub mod state;

use error::IcoError;
use instructions::*;

declare_id!("AyScmNYVgSya8qzk8xXSqsvJjfnwxBv3wHLT6165aLN4");

#[program]
pub mod ico_project {
    use super::*;

    pub fn initialize_ico(
        ctx: Context<InitializeIco>,
        token_price_lamports: u64,
        start_date: i64,
        end_date: i64,
        soft_cap: u64,
        hard_cap: u64,
    ) -> Result<()> {
        require!(soft_cap < hard_cap, IcoError::InvalidCapRange);
        let ico_state = &mut ctx.accounts.ico_state;

        ico_state.authority = ctx.accounts.authority.key();
        ico_state.token_mint = ctx.accounts.token_mint.key();
        ico_state.vault = ctx.accounts.vault.key();
        ico_state.token_price = token_price_lamports;
        ico_state.total_contributed = 0;
        ico_state.start_date = start_date;
        ico_state.end_date = end_date;
        ico_state.soft_cap = soft_cap;
        ico_state.hard_cap = hard_cap;

        // Calculate token amount based on hard cap
        // ✅ FIX: Deserialize mint to read decimals properly
        let mint_info = &ctx.accounts.token_mint.to_account_info();
        let mint_data = mint_info.try_borrow_data()?;
        let mint = Mint::unpack(&mint_data)?;

        let token_amount = hard_cap
            .checked_mul(10u64.pow(mint.decimals as u32))
            .ok_or(IcoError::MathOverflow)?
            .checked_div(token_price_lamports)
            .ok_or(IcoError::InvalidPrice)?;

        ico_state.token_amount = token_amount;

        // ✅ Initialize status
        let ico_status = &mut ctx.accounts.ico_status;
        ico_status.status = IcoStatus::Active as u8;
        ico_status.authority = ctx.accounts.authority.key();

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
        let ico_status = &mut ctx.accounts.ico_status;
        let status_enum = IcoStatus::from_u8(ico_status.status).ok_or(IcoError::InvalidStatus)?;
        require!(status_enum == IcoStatus::Active, IcoError::IcoNotActive);

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
        contribution.ico_state = ctx.accounts.ico_state.key();
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
        require!(
            ico_state.total_contributed >= ico_state.soft_cap,
            IcoError::SoftCapNotReached
        );

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
        let seeds: &[&[u8]] = &[b"ico-state-new", token_mint.as_ref(), &[bump]];
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

        // Only allow after ICO end date
        require!(now >= ico_state.end_date, IcoError::IcoNotEndedYet);

        // Ensure only the original authority can withdraw
        require_keys_eq!(
            ctx.accounts.authority.key(),
            ico_state.authority,
            IcoError::Unauthorized
        );
        // Ensure soft cap is reached
        require!(
            ico_state.total_contributed >= ico_state.soft_cap,
            IcoError::SoftCapNotReached
        );

        let lamports = **ico_state.to_account_info().lamports.borrow();

        **ico_state.to_account_info().try_borrow_mut_lamports()? -= lamports;
        **ctx
            .accounts
            .authority
            .to_account_info()
            .try_borrow_mut_lamports()? += lamports;

        Ok(())
    }
    pub fn refund(ctx: Context<Refund>) -> Result<()> {
        let ico_state = &ctx.accounts.ico_state;
        let contribution = &mut ctx.accounts.contribution;

        let clock = Clock::get()?;
        let now = clock.unix_timestamp;

        let ico_status = &mut ctx.accounts.ico_status;
        let status_enum = IcoStatus::from_u8(ico_status.status).ok_or(IcoError::InvalidStatus)?;
        let cancelled = status_enum == IcoStatus::Cancelled;

        let ico_failed =
            now >= ico_state.end_date && ico_state.total_contributed < ico_state.soft_cap;

        require!(cancelled || ico_failed, IcoError::RefundNotAllowed);

        let refund_amount = contribution.amount;
        require!(refund_amount > 0, IcoError::NoContributionToRefund);

        let ico_lamports = **ctx.accounts.ico_state.to_account_info().lamports.borrow();
        require!(ico_lamports >= refund_amount, IcoError::InsufficientFunds);

        **ctx
            .accounts
            .ico_state
            .to_account_info()
            .try_borrow_mut_lamports()? -= refund_amount;
        **ctx
            .accounts
            .user
            .to_account_info()
            .try_borrow_mut_lamports()? += refund_amount;

        contribution.amount = 0;

        Ok(())
    }

    pub fn update_ico_status(ctx: Context<UpdateIcoStatus>, status: u8) -> Result<()> {
        let status_enum = IcoStatus::from_u8(status).ok_or(IcoError::InvalidStatus)?;
        ctx.accounts.ico_status.status = status_enum as u8;
        Ok(())
    }
}

impl IcoStatus {
    pub fn from_u8(value: u8) -> Option<IcoStatus> {
        match value {
            0 => Some(IcoStatus::Active),
            1 => Some(IcoStatus::Inactive),
            2 => Some(IcoStatus::Cancelled),
            _ => None,
        }
    }
}
#[repr(u8)]
#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub enum IcoStatus {
    Active = 0,
    Inactive = 1,
    Cancelled = 2,
}

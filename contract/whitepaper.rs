use anchor_lang::prelude::*;

declare_id!("24JxCtmEqNyy6PDEfPjYvaoma4A341EiW3jEEHpF9ioS");

#[program]
pub mod whitepaper {
    use super::*;

    pub fn submit_whitepaper(
        ctx: Context<SubmitWhitepaper>,
        cid: String,
        project_name: String,
    ) -> Result<()> {
        let whitepaper = &mut ctx.accounts.whitepaper;
        let meta = &mut ctx.accounts.meta;

        require!(cid.len() < 200, WhitepaperError::CIDTooLong);
        require!(project_name.len() < 100, WhitepaperError::NameTooLong);

        whitepaper.author = ctx.accounts.author.key();
        whitepaper.cid = cid.clone();
        whitepaper.version = meta.version_count + 1;
        whitepaper.timestamp = Clock::get()?.unix_timestamp;
        whitepaper.bump = ctx.bumps.whitepaper;

        meta.author = ctx.accounts.author.key();
        meta.version_count += 1;
        meta.latest_cid = cid.clone();
        meta.last_updated = whitepaper.timestamp;

        if meta.version_count == 1 {
            meta.project_name = project_name;
        }

        emit!(WhitepaperSubmitted {
            author: ctx.accounts.author.key(),
            cid,
            version: whitepaper.version,
        });

        msg!(
            "See details of your metadata: meta.latest_cid = {}, whitepaper.cid = {}",
            meta.latest_cid.to_string(),
            whitepaper.cid.to_string()
        );

        Ok(())
    }
}

#[derive(Accounts)]
#[instruction(cid: String)]
pub struct SubmitWhitepaper<'info> {
    #[account(
        init_if_needed,
        seeds = [b"meta", author.key().as_ref()],
        bump,
        payer = author,
        space = 8 + WhitepaperMeta::INIT_SPACE,
    )]
    pub meta: Account<'info, WhitepaperMeta>,

    #[account(
        init,
        seeds = [author.key().as_ref(), &(meta.version_count + 1).to_le_bytes()],
        bump,
        payer = author,
        space = 8 + WhitepaperState::INIT_SPACE,
    )]
    pub whitepaper: Account<'info, WhitepaperState>,

    #[account(mut)]
    pub author: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[account]
#[derive(InitSpace)]
pub struct WhitepaperState {
    pub author: Pubkey,
    #[max_len(200)]
    pub cid: String,
    pub version: u64,
    pub timestamp: i64,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct WhitepaperMeta {
    pub author: Pubkey,
    #[max_len(200)]
    pub latest_cid: String,
    pub version_count: u64,
    pub last_updated: i64,
    #[max_len(200)]
    pub project_name: String,
}

#[event]
pub struct WhitepaperSubmitted {
    pub author: Pubkey,
    pub cid: String,
    pub version: u64,
}

#[error_code]
pub enum WhitepaperError {
    #[msg("CID is too long.")]
    CIDTooLong,
    #[msg("Project name is too long.")]
    NameTooLong,
}

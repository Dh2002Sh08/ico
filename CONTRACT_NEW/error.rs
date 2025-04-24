use anchor_lang::prelude::*;

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
    #[msg("Soft cap must be less than hard cap.")]
    InvalidCapRange,
    #[msg("Tokens cannot be claimed until the admin has withdrawn SOL.")]
    ClaimNotAllowedYet,
    #[msg("ICO is cancelled or inactive. Withdrawal not allowed.")]
    IcoWithdrawNotAllowed,
    #[msg("Soft cap not reached.")]
    SoftCapNotReached,
    #[msg("Refund is not allowed in the current ICO state.")]
    RefundNotAllowed,
    #[msg("No contribution to refund.")]
    NoContributionToRefund,
    #[msg("ICO has ended already")]
    IcoAlreadyFinalized,
    #[msg("Insufficient fund for Refund")]
    InsufficientFunds,
    #[msg("ICO is either cancelled or inactive.")]
    InvalidStatus,
    #[msg("ICO is not active.")]
    IcoNotActive,
}

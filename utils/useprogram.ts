'use client'

import { BN, Program, AnchorProvider } from '@project-serum/anchor'
import {
  PublicKey,
  SystemProgram,
  Transaction,
  SYSVAR_RENT_PUBKEY,
  Keypair,
} from '@solana/web3.js'
import {
  TOKEN_PROGRAM_ID,
  createInitializeAccountInstruction,
  getMinimumBalanceForRentExemptAccount,
  ACCOUNT_SIZE,
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  getMint,
} from '@solana/spl-token'
import { IDL, programId } from './program'

export const PROGRAM_ID = new PublicKey(programId)

export const VAULT_SEED = 'vault';

export function getVaultAddress() {
  return PublicKey.findProgramAddressSync(
    [Buffer.from(VAULT_SEED)],
    PROGRAM_ID
  );
}

export const [vaultPda] = getVaultAddress();


export function getProgram(provider: AnchorProvider) {
  return new Program(IDL, PROGRAM_ID, provider)
}
export const initializeICO = async ({
  provider,
  tokenMint,
  tokenPriceLamports,
  startDate,
  endDate,
  tokenAmount,
}: {
  provider: AnchorProvider;
  tokenMint: PublicKey;
  tokenPriceLamports: number;
  startDate: number;
  endDate: number;
  tokenAmount: number;
}) => {
  const program = getProgram(provider);

  const [icoState] = PublicKey.findProgramAddressSync(
    [Buffer.from('ico-state'), tokenMint.toBuffer()],
    program.programId
  );

  const userTokenAccount = await getAssociatedTokenAddress(
    tokenMint,
    provider.wallet.publicKey
  );

  const vault = await getAssociatedTokenAddress(
    tokenMint,
    icoState,
    true
  );

  // Build the instruction to create the vault ATA for the icoState (if not exists)
  const createVaultIx = createAssociatedTokenAccountInstruction(
    provider.wallet.publicKey, // payer
    vault,                     // ATA to create
    icoState,                  // owner (PDA)
    tokenMint
  );

  const tx = new Transaction();

  tx.add(createVaultIx);

  const initializeIx = await program.methods
    .initializeIco(
      new BN(tokenPriceLamports),
      new BN(startDate),
      new BN(endDate),
      new BN(tokenAmount)
    )
    .accounts({
      icoState,
      userTokenAccount,
      authority: provider.wallet.publicKey,
      tokenMint,
      vault,
      tokenProgram: TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
    })
    .instruction();

  tx.add(initializeIx);

  try {
    const sig = await provider.sendAndConfirm(tx, []);
    return sig;
  } catch (error: any) {
    console.error('Error initializing ICO:', error);
    if (error.logs) {
      console.error('Transaction logs:', error.logs);
    }
    throw error;
  }
};


export const contributeToICO = async ({
  provider,
  tokenMint,
  lamportsContributed,
}: {
  provider: AnchorProvider;
  tokenMint: PublicKey;
  lamportsContributed: number;
}) => {
  const program = getProgram(provider);

  const [icoState] = PublicKey.findProgramAddressSync(
    [Buffer.from('ico-state'), tokenMint.toBuffer()],
    program.programId
  );

  const [contribution] = PublicKey.findProgramAddressSync(
    [Buffer.from('contribution'), provider.wallet.publicKey.toBuffer()],
    program.programId
  );

  try {
    const tx = await program.methods
      .contribute(new BN(lamportsContributed))
      .accounts({
        user: provider.wallet.publicKey,
        icoState,
        contribution,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    return tx;
  } catch (error: any) {
    console.error('Error contributing to ICO:', error);
    if (error.logs) {
      console.error('Transaction logs:', error.logs);
    }
    throw error;
  }
};
export const claimTokens = async ({
  provider,
  tokenMint,
}: {
  provider: AnchorProvider;
  tokenMint: PublicKey;
}) => {
  const program = getProgram(provider);

  const [icoState] = PublicKey.findProgramAddressSync(
    [Buffer.from('ico-state'), tokenMint.toBuffer()],
    program.programId
  );

  const [contribution] = PublicKey.findProgramAddressSync(
    [Buffer.from('contribution'), provider.wallet.publicKey.toBuffer()],
    program.programId
  );

  const userTokenAccount = await getAssociatedTokenAddress(
    tokenMint,
    provider.wallet.publicKey
  );

  const vaultTokenAccount = await getAssociatedTokenAddress(
    tokenMint,
    icoState,
    true // allowOwnerOffCurve
  );

  try {
    const tx = await program.methods
      .claimTokens()
      .accounts({
        user: provider.wallet.publicKey,
        icoState,
        contribution,
        vaultTokenAccount,
        userTokenAccount,
        tokenMint,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    return tx;
  } catch (error: any) {
    console.error('Error claiming tokens:', error);
    if (error.logs) {
      console.error('Transaction logs:', error.logs);
    }
    throw error;
  }
}

export const withdrawSol = async ({
  provider,
  tokenMint,
}: {
  provider: AnchorProvider;
  tokenMint: PublicKey;
}) => {
  const program = getProgram(provider);

  const [icoState] = PublicKey.findProgramAddressSync(
    [Buffer.from('ico-state'), tokenMint.toBuffer()],
    program.programId
  );

  try {
    const tx = await program.methods
      .withdrawSol()
      .accounts({
        owner: provider.wallet.publicKey,
        icoState,
      })
      .rpc();

    return tx;
  } catch (error: any) {
    console.log('Error withdrawing SOL:', error);
    if (error.logs) {
      console.log('Transaction logs:', error.logs);
    }
    throw error;
  }
};

export const getIcoStatePDA = (tokenMint: PublicKey) => {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('ico-state'), tokenMint.toBuffer()],
    PROGRAM_ID
  )[0];
};

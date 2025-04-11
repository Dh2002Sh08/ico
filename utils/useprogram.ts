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
} from '@solana/spl-token'
import { IDL, programId } from './program'

export const PROGRAM_ID = new PublicKey(programId)

export function getProgram(provider: AnchorProvider) {
  return new Program(IDL, PROGRAM_ID, provider)
}

export const initializeICO = async ({
  provider,
  tokenMint,
  tokenPriceLamports,
}: {
  provider: AnchorProvider
  tokenMint: PublicKey
  tokenPriceLamports: number
}) => {
  const program = getProgram(provider)

  const [icoState] = PublicKey.findProgramAddressSync(
    [Buffer.from('ico-state'), tokenMint.toBuffer()],
    program.programId
  )

  const [icoSigner] = PublicKey.findProgramAddressSync(
    [Buffer.from('ico-signer')],
    program.programId
  )

  // ✅ Create a new vault token account manually with icoSigner as owner
  const vault = Keypair.generate()
  const rent = await getMinimumBalanceForRentExemptAccount(provider.connection)

  const createVaultAccountIx = SystemProgram.createAccount({
    fromPubkey: provider.wallet.publicKey,
    newAccountPubkey: vault.publicKey,
    space: ACCOUNT_SIZE,
    lamports: rent,
    programId: TOKEN_PROGRAM_ID,
  })

  const initVaultIx = createInitializeAccountInstruction(
    vault.publicKey,
    tokenMint,
    icoSigner // ✅ Set the PDA as the owner from the beginning!
  )

  // ✅ Prepare transaction
  const tx = await program.methods
    .initializeIco(new BN(tokenPriceLamports))
    .accounts({
      icoState,
      authority: provider.wallet.publicKey,
      tokenMint,
      vault: vault.publicKey,
      icoSigner,
      systemProgram: SystemProgram.programId,
      tokenProgram: TOKEN_PROGRAM_ID,
      rent: SYSVAR_RENT_PUBKEY,
    })
    .preInstructions([createVaultAccountIx, initVaultIx])
    .signers([vault])
    .transaction()

  tx.feePayer = provider.wallet.publicKey
  tx.recentBlockhash = (await provider.connection.getLatestBlockhash()).blockhash

  const signedTx = await provider.wallet.signTransaction(tx)
  signedTx.partialSign(vault)

  const sig = await provider.connection.sendRawTransaction(signedTx.serialize())
  console.log('✅ ICO Initialized:', sig)
  return sig
}



export const contributeToICO = async ({
  provider,
  tokenMint,
  lamportsContributed,
}: {
  provider: AnchorProvider
  tokenMint: PublicKey
  lamportsContributed: number
}) => {
  const program = getProgram(provider)

  const [icoState] = PublicKey.findProgramAddressSync(
    [Buffer.from('ico-state'), tokenMint.toBuffer()],
    program.programId
  )

  const [contribution] = PublicKey.findProgramAddressSync(
    [Buffer.from('contribution'), provider.wallet.publicKey.toBuffer()],
    program.programId
  )

  return await program.methods
    .contribute(new BN(lamportsContributed))
    .accounts({
      user: provider.wallet.publicKey,
      icoState,
      contribution,
      systemProgram: SystemProgram.programId,
    })
    .rpc()
}

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

  const vault = await getAssociatedTokenAddress(tokenMint, provider.wallet.publicKey); // <- regular wallet now
  const vaultInfo = await provider.connection.getAccountInfo(vault);

  const userTokenAccount = await getAssociatedTokenAddress(
    tokenMint,
    provider.wallet.publicKey
  );

  const tx = new Transaction();

  // Create user ATA if not exists
  const userTokenAccountInfo = await provider.connection.getAccountInfo(userTokenAccount);
  if (!userTokenAccountInfo) {
    tx.add(
      createAssociatedTokenAccountInstruction(
        provider.wallet.publicKey,
        userTokenAccount,
        provider.wallet.publicKey,
        tokenMint
      )
    );
  }

  // Add the claim instruction
  const claimIx = await program.methods
    .claimTokens()
    .accounts({
      user: provider.wallet.publicKey,
      contribution,
      icoState,
      vault,
      destination: userTokenAccount,
      owner: provider.wallet.publicKey, // your wallet as vault owner
      tokenProgram: TOKEN_PROGRAM_ID,
    })
    .instruction();

  tx.add(claimIx);

  return await provider.sendAndConfirm(tx);
};

export const getIcoStatePDA = (tokenMint: PublicKey) => {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('ico-state'), tokenMint.toBuffer()],
    PROGRAM_ID
  )[0]
}

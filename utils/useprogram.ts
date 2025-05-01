import { BN, Program, AnchorProvider } from '@project-serum/anchor';
import {
  PublicKey,
  SystemProgram,
  Transaction,
  SYSVAR_RENT_PUBKEY,
  Keypair,
  SendTransactionError,
} from '@solana/web3.js';
import {
  TOKEN_PROGRAM_ID,
  createInitializeAccountInstruction,
  getMinimumBalanceForRentExemptAccount,
  ACCOUNT_SIZE,
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
} from '@solana/spl-token';
import { IDL, programId } from './program';

export const PROGRAM_ID = new PublicKey(programId);
export const VAULT_SEED = 'vault';

export function getVaultAddress() {
  return PublicKey.findProgramAddressSync(
    [Buffer.from(VAULT_SEED)],
    PROGRAM_ID
  );
}

export const [vaultPda] = getVaultAddress();

export function getProgram(provider: AnchorProvider) {
  return new Program(IDL, PROGRAM_ID, provider);
}

export const initializeICO = async ({
  provider,
  tokenMint,
  tokenPriceLamports,
  startDate,
  endDate,
  softCap,
  hardCap,
}: {
  provider: AnchorProvider;
  tokenMint: PublicKey;
  tokenPriceLamports: number;
  startDate: number;
  endDate: number;
  softCap: number;
  hardCap: number;
}) => {
  const program = getProgram(provider);

  // Derive icoState PDA
  const [icoState] = PublicKey.findProgramAddressSync(
    [Buffer.from('ico-state-new'), tokenMint.toBuffer()],
    program.programId
  );

  console.log('ICO State PDA:', icoState.toBase58());

  const [icoStatus] = PublicKey.findProgramAddressSync(
    [Buffer.from('ico-status'), tokenMint.toBuffer(), Buffer.from('v2')],
    program.programId
  );

  const [whiteList] = PublicKey.findProgramAddressSync(
    [Buffer.from('white_list'), tokenMint.toBuffer()],
    program.programId
  );

  console.log('WhiteList PDA:', whiteList.toBase58());

  console.log('ICO Status PDA:', icoStatus.toBase58());
  // Create a new Keypair for the vault token account
  const vault = await getAssociatedTokenAddress(
    tokenMint,
    icoState,
    true
  );

  // Log the vault public key for debugging
  console.log('Vault public key:', vault.toBase58());

  // Get the user's token account (ATA)
  const userTokenAccount = await getAssociatedTokenAddress(
    tokenMint,
    provider.wallet.publicKey
  );
  console.log('User token account:', userTokenAccount.toBase58());

  // Build the instruction to create the vault ATA for the icoState (if not exists)
  const createVaultIx = createAssociatedTokenAccountInstruction(
    provider.wallet.publicKey, // payer
    vault,                     // ATA to create
    icoState,                  // owner (PDA)
    tokenMint
  );

  const tx = new Transaction();

  tx.add(createVaultIx);

  // Build the initializeIco instruction
  const initializeIx = await program.methods
    .initializeIco(
      new BN(tokenPriceLamports),
      new BN(startDate),
      new BN(endDate),
      new BN(softCap),
      new BN(hardCap)
    )
    .accounts({
      icoState,
      icoStatus,
      whiteList,
      userTokenAccount,
      authority: provider.wallet.publicKey,
      tokenMint,
      vault,
      tokenProgram: TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
    })
    .instruction();

  tx.add(initializeIx);

  // Log accounts for debugging
  console.log('Accounts in transaction:', {
    icoState: icoState.toBase58(),
    userTokenAccount: userTokenAccount.toBase58(),
    authority: provider.wallet.publicKey.toBase58(),
    tokenMint: tokenMint.toBase58(),
    vault: vault.toBase58(),
  });

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
    [Buffer.from('ico-state-new'), tokenMint.toBuffer()],
    program.programId
  );

  const [icoStatus] = PublicKey.findProgramAddressSync(
    [Buffer.from('ico-status'), tokenMint.toBuffer(), Buffer.from('v2')],
    program.programId
  );

  const [contribution] = PublicKey.findProgramAddressSync(
    [Buffer.from('contribution'), provider.wallet.publicKey.toBuffer(), icoState.toBuffer()],
    program.programId
  );

  const [whiteList] = PublicKey.findProgramAddressSync(
    [Buffer.from('white_list'), tokenMint.toBuffer()],
    program.programId
  );
  console.log('Available accounts:', Object.keys(program.account));

  console.log('WhiteList PDA:', whiteList.toBase58());
  try {
    const tx = await program.methods
      .contribute(new BN(lamportsContributed))
      .accounts({
        user: provider.wallet.publicKey,
        icoState,
        icoStatus,
        whiteList,
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
    [Buffer.from('ico-state-new'), tokenMint.toBuffer()],
    program.programId
  );

  const [contribution] = PublicKey.findProgramAddressSync(
    [Buffer.from('contribution'), provider.wallet.publicKey.toBuffer(), icoState.toBuffer()],
    program.programId
  );

  const userTokenAccount = await getAssociatedTokenAddress(
    tokenMint,
    provider.wallet.publicKey
  );

  console.log('User token account:', userTokenAccount.toBase58());

  const vaultTokenAccount = await getAssociatedTokenAddress(
    tokenMint,
    icoState,
    true // allowOwnerOffCurve
  );
  console.log('Vault token account:', vaultTokenAccount.toBase58());

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
    [Buffer.from('ico-state-new'), tokenMint.toBuffer()],
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

export const refund = async({
  provider,
  tokenMint,
  }:
{
  provider: AnchorProvider;
  tokenMint: PublicKey;
}) => {
  const program = getProgram(provider);

  const [icoState] = PublicKey.findProgramAddressSync(
    [Buffer.from('ico-state-new'), tokenMint.toBuffer()],
    program.programId
  );
  console.log('ICO State PDA:', icoState.toBase58());

  const [icoStatus] = PublicKey.findProgramAddressSync(
    [Buffer.from('ico-status'), tokenMint.toBuffer(), Buffer.from('v2')],
    program.programId
  );
  console.log('ICO Status PDA:', icoStatus.toBase58());

  const [contribution] = PublicKey.findProgramAddressSync(
    [Buffer.from('contribution'), provider.wallet.publicKey.toBuffer(), icoState.toBuffer()],
    program.programId
  );
  console.log('Contribution PDA:', contribution.toBase58());

  try {
    const tx = await program.methods
      .refund()
      .accounts({
        icoState,
        icoStatus,
        contribution,
        user: provider.wallet.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
    console.log('Refund transaction:', tx);
    return tx;
  } catch (error: any) {
    console.log('Error refunding:', error);
    if (error.logs) {
      console.log('Transaction logs:', error.logs);
    }
    throw error;
  }
}

// Change the ico state
// active, inactive, cancelled

export const updateIcoStatus = async ({
  provider,
  tokenMint,
  status,
}: {
  provider: AnchorProvider;
  tokenMint: PublicKey;
  status: number; // 0 = Active, 1 = Inactive, 2 = Cancelled
}) => {
  const program = getProgram(provider);

  console.log("Status choose", status);

  // const [icoState] = PublicKey.findProgramAddressSync(
  //   [Buffer.from('ico-state-new'), tokenMint.toBuffer()],
  //   program.programId
  // );

  const [icoStatus] = PublicKey.findProgramAddressSync(
    [Buffer.from('ico-status'), tokenMint.toBuffer(), Buffer.from('v2')],
    program.programId
  );

  try {
    const tx = await program.methods
      .updateIcoStatus(status) // pass u8
      .accounts({
        icoStatus,
        authority: provider.wallet.publicKey,
      })
      .rpc();

    console.log('ICO Status Updated:', tx);
    return tx;
  } catch (error: any) {
    console.error('Error updating ICO status:', error);
    if (error.logs) {
      console.log('Transaction logs:', error.logs);
    }
    throw error;
  }
};

export const addToWhitelist = async ({
  provider,
  walletKey,
  tokenMint,
}: {
  provider: AnchorProvider;
  walletKey: PublicKey[];
  tokenMint: PublicKey;
}) => {
  const program = getProgram(provider);

  const [icoState] = PublicKey.findProgramAddressSync(
    [Buffer.from('ico-state-new'), tokenMint.toBuffer()],
    program.programId
  );
  console.log('ICO State PDA:', icoState.toBase58());

  const [whiteList] = PublicKey.findProgramAddressSync(
    [Buffer.from('white_list'), tokenMint.toBuffer()],
    program.programId
  );

  try {
    const tx = await program.methods
      .addToWhitelist(walletKey)
      .accounts({
        whiteList,
        icoState,
        admin: provider.wallet.publicKey,
      })
      .rpc();

    return tx;
  } catch (error: any) {
    console.error('Error adding to whitelist:', error);
    if (error.logs) {
      console.error('Transaction logs:', error.logs);
    }
    throw error;
  }

};

export const toggleWhitelist = async ({
  provider,
  tokenMint,
  enable,
}: {
  provider: AnchorProvider;
  tokenMint: PublicKey;
  enable: boolean;
}) => {
  const program = getProgram(provider);
  console.log('Enable:', enable);
  const [icoState] = PublicKey.findProgramAddressSync(
    [Buffer.from('ico-state-new'), tokenMint.toBuffer()],
    program.programId
  );
  console.log('ICO State PDA:', icoState.toBase58());

  const [whiteList] = PublicKey.findProgramAddressSync(
    [Buffer.from('white_list'), tokenMint.toBuffer()],
    program.programId
  );

  try {
    const tx = await program.methods
      .toggleWhitelist(enable)
      .accounts({
        whiteList,
        icoState,
        admin: provider.wallet.publicKey,
      })
      .rpc();

    return tx;
  } catch (error: any) {
    console.error('Error toggling whitelist:', error);
    if (error.logs) {
      console.error('Transaction logs:', error.logs);
    }
    throw error;
  }
}

export const fetchWhitelistData = async (provider: AnchorProvider, tokenMint: PublicKey) => {
  const program = getProgram(provider);
  const [whitelistPDA] = PublicKey.findProgramAddressSync(
      [Buffer.from("white_list"), tokenMint.toBuffer()],
      program.programId
  );
  const account = await program.account.whiteList.fetch(whitelistPDA);
  // console.log('Whitelist Account:', account.authority.toBase58());
  return {
      enable: account.enable,
      authority: account.authority,
      addresses: account.whitelistedAddresses,
  };
};

// fetch icostatusData
export const fetchIcoStatusData = async (provider: AnchorProvider, tokenMint: PublicKey) => {
  const program = getProgram(provider);
  const [icoStatusPDA] = PublicKey.findProgramAddressSync(
      [Buffer.from("ico-status"), tokenMint.toBuffer(), Buffer.from('v2')],
      program.programId
  );
  const account = await program.account.icoStatusAccount.fetch(icoStatusPDA);
  console.log('ICO Status Account:', account.authority.toBase58());
  return {
      authority: account.authority,
      status: account.status,
  };
};




// export const updateICOstate = async ({
//   provider,
//   state,
//   tokenMint,
// }:{
//   provider: AnchorProvider,
//   state: String,
//   tokenMint: PublicKey,
// }) =>{
//   const program = getProgram(provider);

//   const [icoState] = PublicKey.findProgramAddressSync(
//     [Buffer.from('ico-state-new'), tokenMint.toBuffer()],
//     program.programId
//   );
//   console.log('ICO State PDA:', icoState.toBase58());
//   console.log('State:', state);

//   const getStatusEnum = (state: string) => {
//     switch (state.toLowerCase()) {
//       case 'active':
//         return { active: {} };
//       case 'inactive':
//         return { inactive: {} };
//       case 'stopped':
//         return { stopped: {} };
//       case 'cancelled':
//         return { cancelled: {} };
//       default:
//         throw new Error(`Invalid state: ${state}`);
//     }
//   };

//   const statusEnum = getStatusEnum(state.toString());

//   try {
//     const tx = await program.methods
//       .updateIcoStatus(statusEnum)
//       .accounts({
//         icoState,
//         authority: provider.wallet.publicKey,
//       })
//       .rpc();

//     return tx;
//   } catch (error: any) {
//     console.log('Error updating ICO state:', error);
//     if (error.logs) {
//       console.log('Transaction logs:', error.logs);
//     }
//     throw error;
//   }
// }

export const getIcoStatePDA = (tokenMint: PublicKey) => {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('ico-state-new'), tokenMint.toBuffer()],
    PROGRAM_ID
  )[0];

  
};

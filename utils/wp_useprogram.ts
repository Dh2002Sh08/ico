'use client'

import { BN, Program, AnchorProvider } from '@project-serum/anchor'
import {
    PublicKey,
    SystemProgram,
} from '@solana/web3.js'
import { IDL, programId } from './wp_program'


// Define the WhitepaperMeta structure (match your frontend)
interface WhitepaperMeta {
  projectName: string;
  versionCount: number;
  latestCid: string;
  lastUpdated: BN;
  publicKey: PublicKey;
}


export const PROGRAM_ID = new PublicKey(programId)

export const META_SEED = 'meta';
export const WHITEPAPER_SEED = 'whitepaper';

export function getProgram(provider: AnchorProvider) {
    return new Program(IDL, PROGRAM_ID, provider)
}
export const submitWhitepaper = async ({
    provider,
    cid,
    author,
    projectName
}: {
    provider: AnchorProvider,
    cid: string,
    author: PublicKey,
    projectName: string,
}) => {
    const program = getProgram(provider);

    // Deriving the 'meta' PDA
    const [metaPda] = await PublicKey.findProgramAddressSync(
        [Buffer.from(META_SEED), provider.wallet.publicKey.toBuffer()],
        PROGRAM_ID
    );
    console.log('Meta PDA:', metaPda.toBase58());

    // Fetch the meta account to get version count
    const metaAccount = await program.account.whitepaperMeta.fetchNullable(metaPda);

    // Check if the 'meta' account exists, if not create it
    let version = 1; // Default version 1 if meta doesn't exist
    if (metaAccount) {
        version = metaAccount.versionCount.toNumber() + 1;
    }

    const versionBuffer = new Uint8Array(new BN(version).toArray('le', 8)); // Convert version to 8-byte array
    // Deriving the 'whitepaper' PDA using the correct version
    const [whitepaperPda] = await PublicKey.findProgramAddressSync(
        [provider.wallet.publicKey.toBuffer(), versionBuffer],
        PROGRAM_ID
    );
    console.log('Whitepaper PDA:', whitepaperPda.toBase58());

    // Calling the smart contract to submit the whitepaper
    const tx = await program.methods.submitWhitepaper(cid, projectName)
        .accounts({
            meta: metaPda,
            whitepaper: whitepaperPda,
            author: provider.wallet.publicKey,
            systemProgram: SystemProgram.programId,
        })
        .rpc();

    return tx;
};

// Fetch 'meta' data
export async function fetchMetaData(provider: AnchorProvider, metaPda: PublicKey) {
  const program = getProgram(provider);
  const metaAccount = await program.account.whitepaperMeta.fetch(metaPda);
  return {
    projectName: metaAccount.projectName,
    versionCount: metaAccount.versionCount.toString(),
    latestCid: metaAccount.latestCid,
    lastUpdated: metaAccount.lastUpdated,
  };
}

// Fetch 'whitepaper' data
export async function fetchWhitepaperData(provider: AnchorProvider, whitepaperPda: PublicKey) {
  const program = getProgram(provider);
  const whitepaperAccount = await program.account.whitepaperState.fetch(whitepaperPda);
  return {
    cid: whitepaperAccount.cid,
    version: whitepaperAccount.version.toString(),
    timestamp: whitepaperAccount.timestamp,
  };
}

// Fetch all meta accounts for a given user's public key
export async function fetchAllMetaAccountsByUser(
  provider: AnchorProvider,
  userPublicKey: PublicKey
): Promise<WhitepaperMeta[]> {
  const program = getProgram(provider);

  const metas = await program.account.whitepaperMeta.all([
    {
      memcmp: {
        offset: 8, // Skip 8-byte discriminator; assumes 'author' is the first field
        bytes: userPublicKey.toBase58(),
      },
    },
  ]);

  return metas.map(({ publicKey, account }) => ({
    publicKey,
    projectName: account.projectName,
    versionCount: account.versionCount,
    latestCid: account.latestCid,
    lastUpdated: account.lastUpdated,
  }));
}

// (Still available if you want to use it for single-PDA cases)
export async function fetchMetaAndWhitepaperPdas(walletPublicKey: PublicKey, provider: AnchorProvider) {
  const [metaPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("meta"), walletPublicKey.toBuffer()],
    PROGRAM_ID
  );

  const program = getProgram(provider);
  let version = 1; // Default version 1
  const metaAccount = await program.account.whitepaperMeta.fetchNullable(metaPda);
  if (metaAccount) {
    version = metaAccount.versionCount.toNumber() + 1;
  }

  const versionBuffer = new Uint8Array(new BN(version).toArray("le", 8));
  const [whitepaperPda] = PublicKey.findProgramAddressSync(
    [walletPublicKey.toBuffer(), versionBuffer],
    PROGRAM_ID
  );

  return [metaPda, whitepaperPda];
}

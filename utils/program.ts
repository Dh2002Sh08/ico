import { Idl } from "@project-serum/anchor";

export const programId = 'AyScmNYVgSya8qzk8xXSqsvJjfnwxBv3wHLT6165aLN4';

export const IDL: Idl = {
    "version": "0.1.0",
    "name": "ico_project",
    "instructions": [
        {
            "name": "initializeIco",
            "accounts": [
                {
                    "name": "icoState",
                    "isMut": true,
                    "isSigner": false
                },
                {
                    "name": "userTokenAccount",
                    "isMut": true,
                    "isSigner": false
                },
                {
                    "name": "authority",
                    "isMut": true,
                    "isSigner": true
                },
                {
                    "name": "tokenMint",
                    "isMut": true,
                    "isSigner": false
                },
                {
                    "name": "vault",
                    "isMut": true,
                    "isSigner": false
                },
                {
                    "name": "tokenProgram",
                    "isMut": false,
                    "isSigner": false
                },
                {
                    "name": "systemProgram",
                    "isMut": false,
                    "isSigner": false
                }
            ],
            "args": [
                {
                    "name": "tokenPriceLamports",
                    "type": "u64"
                },
                {
                    "name": "startDate",
                    "type": "i64"
                },
                {
                    "name": "endDate",
                    "type": "i64"
                },
                {
                    "name": "tokenAmount",
                    "type": "u64"
                }
            ]
        },
        {
            "name": "contribute",
            "accounts": [
                {
                    "name": "user",
                    "isMut": true,
                    "isSigner": true
                },
                {
                    "name": "icoState",
                    "isMut": true,
                    "isSigner": false
                },
                {
                    "name": "contribution",
                    "isMut": true,
                    "isSigner": false
                },
                {
                    "name": "systemProgram",
                    "isMut": false,
                    "isSigner": false
                }
            ],
            "args": [
                {
                    "name": "amount",
                    "type": "u64"
                }
            ]
        },
        {
            "name": "claimTokens",
            "accounts": [
                {
                    "name": "user",
                    "isMut": true,
                    "isSigner": true
                },
                {
                    "name": "icoState",
                    "isMut": true,
                    "isSigner": false
                },
                {
                    "name": "contribution",
                    "isMut": true,
                    "isSigner": false
                },
                {
                    "name": "vaultTokenAccount",
                    "isMut": true,
                    "isSigner": false
                },
                {
                    "name": "userTokenAccount",
                    "isMut": true,
                    "isSigner": false
                },
                {
                    "name": "tokenMint",
                    "isMut": true,
                    "isSigner": false
                },
                {
                    "name": "tokenProgram",
                    "isMut": false,
                    "isSigner": false
                },
                {
                    "name": "systemProgram",
                    "isMut": false,
                    "isSigner": false
                }
            ],
            "args": []
        },
        {
            "name": "withdrawSol",
            "accounts": [
                {
                    "name": "authority",
                    "isMut": true,
                    "isSigner": true
                },
                {
                    "name": "icoState",
                    "isMut": true,
                    "isSigner": false
                }
            ],
            "args": []
        }
    ],
    "accounts": [
        {
            "name": "IcoState",
            "type": {
                "kind": "struct",
                "fields": [
                    {
                        "name": "authority",
                        "type": "publicKey"
                    },
                    {
                        "name": "tokenMint",
                        "type": "publicKey"
                    },
                    {
                        "name": "vault",
                        "type": "publicKey"
                    },
                    {
                        "name": "tokenPrice",
                        "type": "u64"
                    },
                    {
                        "name": "totalContributed",
                        "type": "u64"
                    },
                    {
                        "name": "startDate",
                        "type": "i64"
                    },
                    {
                        "name": "endDate",
                        "type": "i64"
                    },
                    {
                        "name": "tokenAmount",
                        "type": "u64"
                    }
                ]
            }
        },
        {
            "name": "Contribution",
            "type": {
                "kind": "struct",
                "fields": [
                    {
                        "name": "user",
                        "type": "publicKey"
                    },
                    {
                        "name": "amount",
                        "type": "u64"
                    }
                ]
            }
        }
    ],
    "errors": [
        {
            "code": 6000,
            "name": "InvalidSigner",
            "msg": "Invalid PDA signer."
        },
        {
            "code": 6001,
            "name": "InvalidMint",
            "msg": "Invalid mint configuration."
        },
        {
            "code": 6002,
            "name": "InvalidVaultOwner",
            "msg": "Invalid vault owner."
        },
        {
            "code": 6003,
            "name": "InvalidVaultMint",
            "msg": "Invalid vault mint."
        },
        {
            "code": 6004,
            "name": "Overflow",
            "msg": "Arithmetic overflow."
        },
        {
            "code": 6005,
            "name": "NothingToClaim",
            "msg": "Nothing to claim."
        },
        {
            "code": 6006,
            "name": "InvalidPrice",
            "msg": "Invalid Price"
        },
        {
            "code": 6007,
            "name": "InvalidTokenAccount",
            "msg": "Invalid Account"
        },
        {
            "code": 6008,
            "name": "InvalidContribution",
            "msg": "Invalid Contribution"
        },
        {
            "code": 6009,
            "name": "Unauthorized",
            "msg": "Unauthorized: Only ICO creator can withdraw"
        },
        {
            "code": 6010,
            "name": "MathOverflow",
            "msg": "Mathematics logic fails"
        }
    ]
}
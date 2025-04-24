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
                    "name": "icoStatus",
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
                    "name": "softCap",
                    "type": "u64"
                },
                {
                    "name": "hardCap",
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
                    "name": "icoStatus",
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
        },
        {
            "name": "refund",
            "accounts": [
                {
                    "name": "icoState",
                    "isMut": true,
                    "isSigner": false
                },
                {
                    "name": "icoStatus",
                    "isMut": true,
                    "isSigner": false
                },
                {
                    "name": "contribution",
                    "isMut": true,
                    "isSigner": false
                },
                {
                    "name": "user",
                    "isMut": true,
                    "isSigner": true
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
            "name": "updateIcoStatus",
            "accounts": [
                {
                    "name": "icoStatus",
                    "isMut": true,
                    "isSigner": false
                },
                {
                    "name": "authority",
                    "isMut": false,
                    "isSigner": true
                }
            ],
            "args": [
                {
                    "name": "status",
                    "type": "u8"
                }
            ]
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
                    },
                    {
                        "name": "softCap",
                        "type": "u64"
                    },
                    {
                        "name": "hardCap",
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
                        "name": "icoState",
                        "type": "publicKey"
                    },
                    {
                        "name": "amount",
                        "type": "u64"
                    }
                ]
            }
        },
        {
            "name": "IcoStatusAccount",
            "type": {
                "kind": "struct",
                "fields": [
                    {
                        "name": "status",
                        "type": "u8"
                    },
                    {
                        "name": "authority",
                        "type": "publicKey"
                    }
                ]
            }
        }
    ],
    "types": [
        {
            "name": "IcoStatus",
            "type": {
                "kind": "enum",
                "variants": [
                    {
                        "name": "Active"
                    },
                    {
                        "name": "Inactive"
                    },
                    {
                        "name": "Cancelled"
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
        },
        {
            "code": 6011,
            "name": "InvalidContributionTime",
            "msg": "Contributions are only allowed during the ICO period."
        },
        {
            "code": 6012,
            "name": "IcoNotEndedYet",
            "msg": "Wait for ICO to be ended"
        },
        {
            "code": 6013,
            "name": "BelowMinimumContribution",
            "msg": "Contribution is below the minimum allowed (0.0001 SOL)."
        },
        {
            "code": 6014,
            "name": "AboveMaximumContribution",
            "msg": "Contribution exceeds the maximum allowed per wallet (4.5 SOL)."
        },
        {
            "code": 6015,
            "name": "InvalidCapRange",
            "msg": "Soft cap must be less than hard cap."
        },
        {
            "code": 6016,
            "name": "ClaimNotAllowedYet",
            "msg": "Tokens cannot be claimed until the admin has withdrawn SOL."
        },
        {
            "code": 6017,
            "name": "IcoWithdrawNotAllowed",
            "msg": "ICO is cancelled or inactive. Withdrawal not allowed."
        },
        {
            "code": 6018,
            "name": "SoftCapNotReached",
            "msg": "Soft cap not reached."
        },
        {
            "code": 6019,
            "name": "RefundNotAllowed",
            "msg": "Refund is not allowed in the current ICO state."
        },
        {
            "code": 6020,
            "name": "NoContributionToRefund",
            "msg": "No contribution to refund."
        },
        {
            "code": 6021,
            "name": "IcoAlreadyFinalized",
            "msg": "ICO has ended already"
        },
        {
            "code": 6022,
            "name": "InsufficientFunds",
            "msg": "Insufficient fund for Refund"
        },
        {
            "code": 6023,
            "name": "InvalidStatus",
            "msg": "ICO is either cancelled or inactive."
        },
        {
            "code": 6024,
            "name": "IcoNotActive",
            "msg": "ICO is not active."
        }
    ]
}
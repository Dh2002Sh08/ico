import { Idl } from "@project-serum/anchor";

export const programId = '24JxCtmEqNyy6PDEfPjYvaoma4A341EiW3jEEHpF9ioS';

export const IDL: Idl ={
    "version": "0.1.0",
    "name": "whitepaper",
    "instructions": [
        {
            "name": "submitWhitepaper",
            "accounts": [
                {
                    "name": "meta",
                    "isMut": true,
                    "isSigner": false
                },
                {
                    "name": "whitepaper",
                    "isMut": true,
                    "isSigner": false
                },
                {
                    "name": "author",
                    "isMut": true,
                    "isSigner": true
                },
                {
                    "name": "systemProgram",
                    "isMut": false,
                    "isSigner": false
                }
            ],
            "args": [
                {
                    "name": "cid",
                    "type": "string"
                },
                {
                    "name": "projectName",
                    "type": "string"
                }
            ]
        }
    ],
    "accounts": [
        {
            "name": "WhitepaperState",
            "type": {
                "kind": "struct",
                "fields": [
                    {
                        "name": "author",
                        "type": "publicKey"
                    },
                    {
                        "name": "cid",
                        "type": "string"
                    },
                    {
                        "name": "version",
                        "type": "u64"
                    },
                    {
                        "name": "timestamp",
                        "type": "i64"
                    },
                    {
                        "name": "bump",
                        "type": "u8"
                    }
                ]
            }
        },
        {
            "name": "WhitepaperMeta",
            "type": {
                "kind": "struct",
                "fields": [
                    {
                        "name": "author",
                        "type": "publicKey"
                    },
                    {
                        "name": "latestCid",
                        "type": "string"
                    },
                    {
                        "name": "versionCount",
                        "type": "u64"
                    },
                    {
                        "name": "lastUpdated",
                        "type": "i64"
                    },
                    {
                        "name": "projectName",
                        "type": "string"
                    }
                ]
            }
        }
    ],
    "events": [
        {
            "name": "WhitepaperSubmitted",
            "fields": [
                {
                    "name": "author",
                    "type": "publicKey",
                    "index": false
                },
                {
                    "name": "cid",
                    "type": "string",
                    "index": false
                },
                {
                    "name": "version",
                    "type": "u64",
                    "index": false
                }
            ]
        }
    ],
    "errors": [
        {
            "code": 6000,
            "name": "CIDTooLong",
            "msg": "CID is too long."
        },
        {
            "code": 6001,
            "name": "NameTooLong",
            "msg": "Project name is too long."
        }
    ]
}
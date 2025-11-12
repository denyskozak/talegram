import {Ed25519Keypair} from "@mysten/sui/keypairs/ed25519";

export const keypair = Ed25519Keypair.fromSecretKey(process.env.SECRET_KEY!);

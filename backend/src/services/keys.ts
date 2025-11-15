import {Ed25519Keypair} from "@mysten/sui/keypairs/ed25519";
import {readFileSync} from "fs";
import path from "node:path";

const file = readFileSync( path.join(process.cwd(), '.env'),  { encoding: 'utf8', flag: 'r' })
console.log("import.meta: ", file);

export const getKeypair = () => Ed25519Keypair.fromSecretKey(process.env.SECRET_KEY!);

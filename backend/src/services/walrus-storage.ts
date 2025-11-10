import {  SuiJsonRpcClient } from '@mysten/sui/jsonRpc';
import {walrus,} from '@mysten/walrus';
import {getFullnodeUrl} from "@mysten/sui/client";
import {Ed25519Keypair} from "@mysten/sui/keypairs/ed25519";

export const suiClient = new SuiJsonRpcClient({
    url: getFullnodeUrl('testnet'),
    // Setting network on your client is required for walrus to work correctly
    network: 'testnet',
}).$extend(walrus());

console.log("process.env.SECRET_KEY: ", process.env);
export const keypair = Ed25519Keypair.fromSecretKey(process.env.SECRET_KEY!);


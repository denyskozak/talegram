import {  SuiJsonRpcClient } from '@mysten/sui/jsonRpc';
import {walrus,} from '@mysten/walrus';
import {getFullnodeUrl} from "@mysten/sui/client";

export const suiClient = new SuiJsonRpcClient({
    url: getFullnodeUrl('testnet'),
    // Setting network on your client is required for walrus to work correctly
    network: 'testnet',
}).$extend(walrus({
    storageNodeClientOptions: {
        onError: (error) => console.log(error),
    },
    uploadRelay: {
        host: 'https://upload-relay.testnet.walrus.space',
        timeout: 60_000,
        sendTip: {
            max: 1_000,
        },
    },
}));

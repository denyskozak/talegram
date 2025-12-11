import {  SuiJsonRpcClient } from '@mysten/sui/jsonRpc';
import {walrus,} from '@mysten/walrus';
import {getFullnodeUrl} from "@mysten/sui/client";

export const suiClient = new SuiJsonRpcClient({
    url: getFullnodeUrl('mainnet'),
    // Setting network on your client is required for walrus to work correctly
    network: 'mainnet',
}).$extend(walrus({
    storageNodeClientOptions: {
        onError: (error) => console.log(error),
    },
    uploadRelay: {
        host: 'https://upload-relay.mainnet.walrus.space',
        timeout: 10 * 60_000, // 10 min
        sendTip: {
            max: 6361520,
        },
    },
}));

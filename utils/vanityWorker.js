import { parentPort, workerData } from 'worker_threads';
import { generateSigner } from '@metaplex-foundation/umi';
import { createUmi } from '@metaplex-foundation/umi-bundle-defaults';

const { endpoint, targetPrefix } = workerData; // Receive from index.js
const umi = createUmi(endpoint);

let attempts = 0;
while (true) {
    const mint = generateSigner(umi);
    const mintAddress = mint.publicKey.toString();
    attempts++;
    if (mintAddress.startsWith(targetPrefix)) {
        parentPort.postMessage({
            publicKey: mint.publicKey.toString(),
            secretKey: Array.from(mint.secretKey),
            attempts: attempts
        });
        break;
    }
}
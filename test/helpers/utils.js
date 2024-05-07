const hre = require('hardhat');

let cachedIsVechainNetwork;
async function checkIfVechainNetwork(provider, networkName) {
    let version;
    if (cachedIsVechainNetwork === undefined) {
        try {
            const response = await provider.request({
                method: "web3_clientVersion",
            });
            version = response.toString();
            cachedIsVechainNetwork = version.toLowerCase().startsWith("thor");
        } catch (e) {
            cachedIsVechainNetwork = false;
        }
    }
    if (!cachedIsVechainNetwork) {
        throw new Error("TODO: write appropriate error message");
    }
    return cachedIsVechainNetwork;
}

async function getVechainProvider() {
    const provider = hre.network.provider;

    await checkIfVechainNetwork(provider, hre.network.name);

    return hre.network.provider;
}

/**
 * Returns the number of the latest block
 */
async function latestBlock() {
    const provider = await getVechainProvider();
    const height = (await provider.request({
        method: "eth_blockNumber",
        params: [],
    }));

    return parseInt(height, 16);
}

/**
 * Returns the timestamp of the latest block
 */
async function latest() {
    const provider = await getVechainProvider();

    const latestBlock = (await provider.request({
        method: "eth_getBlockByNumber",
        params: ["latest", false],
    }));

    return parseInt(latestBlock.timestamp, 16);
}

module.exports = {
    latest,
    latestBlock,
    getVechainProvider
}
const { promises: fs } = require('fs');
const path = require('path');
const {
    pairsToEntries,
    getRemoved,
    getValidPairsFromRemoved,
    getSortedByDisguisePairs,
} = require('./helpers');

const TRACKERS_DIR_PATH = '../../trackers';
const INFO_FILE_FORMAT = 'json';

const mergeDomainsInfo = async (companyName, fetchedDomainsInfo) => {
    const infoFileName = `${companyName}.${INFO_FILE_FORMAT}`;
    const oldInfoContent = await fs.readFile(
        path.resolve(__dirname, TRACKERS_DIR_PATH, infoFileName),
    );
    const oldInfo = JSON.parse(oldInfoContent);

    const newInfoPairs = fetchedDomainsInfo
        .flatMap(({ cloaked_trackers: cloakedTrackers }) => cloakedTrackers)
        .filter((i) => i);
    const newInfo = Object.fromEntries(pairsToEntries(newInfoPairs));

    const removedDiff = getRemoved(oldInfo, newInfo);
    const validRemovedPairs = await getValidPairsFromRemoved(removedDiff);

    const mergedPairs = [
        ...newInfoPairs,
        ...validRemovedPairs,
    ];

    const mergedEntries = pairsToEntries(mergedPairs);
    const sortedPairs = getSortedByDisguisePairs(mergedEntries);

    return sortedPairs;
};

module.exports = { mergeDomainsInfo };

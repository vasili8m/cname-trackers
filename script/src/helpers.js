const dnsPromises = require('dns').promises;

const replace = (str, replaceable, replacement) => str
    .split(replaceable)
    .map((word) => word.trim())
    .filter((i) => i)
    .join(replacement);

const formatFilename = (companyName) => {
    const lowerCased = companyName.toLowerCase();
    const dashed = replace(lowerCased, ' ', '-');
    const lowerDashed = replace(dashed, '.', '_');
    return lowerDashed;
};

const sleep = (timeout) => new Promise((resolve) => {
    setTimeout(resolve, timeout);
});

const sortAscending = (a, b) => {
    if (a > b) {
        return 1;
    }

    if (a < b) {
        return -1;
    }

    return 0;
};

const pairsToEntries = (pairs) => pairs.map(({ disguise, tracker }) => [disguise, tracker]);

const getRemoved = (oldInfo, newInfo) => {
    const removed = Object.keys(oldInfo)
        .reduce((diff, key) => {
            if (oldInfo[key] === newInfo[key]) return diff;
            return {
                ...diff,
                [key]: oldInfo[key],
            };
        }, {});
    return removed;
};

const resolveCname = async (disguise) => {
    let res;
    try {
        res = await dnsPromises.resolveCname(disguise);
    } catch (e) {
        res = null;
    }
    return res;
};

const resolveCnameWithRetry = async (disguise) => {
    const RETRY_TIMOUT_MS = 5 * 1000;
    let res = await resolveCname(disguise);
    // if cname resolving failed, check it few more times
    if (res === null) {
        await sleep(RETRY_TIMOUT_MS);
        res = await resolveCname(disguise);
    }
    if (res === null) {
        await sleep(RETRY_TIMOUT_MS);
        res = await resolveCname(disguise);
    }
    return res;
};

const getCnamesChain = async (disguise, acc = []) => {
    const res = await resolveCnameWithRetry(disguise);
    // collect cnames until there is no one left
    if (res !== null) {
        // domain can have only one canonical name
        acc.push(res[0]);
        await getCnamesChain(res[0], acc);
    }
    return acc;
};

const validateCname = async (disguise, tracker) => {
    const cnameChain = await getCnamesChain(disguise);
    if (!cnameChain.length) {
        return false;
    }
    return cnameChain.includes(tracker);
};

const getValidPairsFromRemoved = async (removedInfo) => {
    const validInfo = await Promise.all(Object.entries(removedInfo)
        .map(async ([disguise, tracker]) => {
            const isValid = await validateCname(disguise, tracker);
            return isValid ? { disguise, tracker } : null;
        }));
    // filter nulls after cname validation
    return validInfo.filter((r) => r);
};

const sortMergedInfo = (mergedInfo, mainDomains) => {
    const preparedAcc = mainDomains
        .map((domain) => {
            const startItem = {
                domain_name: domain,
                cloaked_trackers: [],
            };
            return startItem;
        });
    const sorted = mergedInfo
        .reduce((acc, el) => {
            const { tracker } = el;
            const ind = acc.findIndex((res) => tracker === res.domain_name
                || tracker.endsWith(`.${res.domain_name}`));
            if (ind === -1) {
                const resItem = {
                    domain_name: tracker,
                    cloaked_trackers: [el],
                };
                acc.push(resItem);
            } else {
                acc[ind].cloaked_trackers.push(el);
            }
            return acc;
        }, preparedAcc);
    return sorted;
};

const getSortedByDisguisesObj = (entries) => {
    const sorted = entries
        // alphabetically sort by disguise which is first in pairs "disguise-tracker"
        .sort((first, second) => first[0].localeCompare(second[0]));
    return Object.fromEntries(sorted);
};

const replaceFinalCname = async (entries) => {
    // needed for recovering trackers for failed final cname checking
    const reservedData = Object.fromEntries(entries);
    const disguises = Object.keys(reservedData);
    const uniqDisguises = [...new Set(disguises)];
    // check final cnames only for unique disguises
    const finalEntries = await Promise.all(uniqDisguises
        .map(async (disguise) => {
            const cnameChain = await getCnamesChain(disguise);
            let finalCname = cnameChain[cnameChain.length - 1];
            if (!finalCname) {
                finalCname = reservedData[disguise];
            }
            return [disguise, finalCname];
        }));
    return finalEntries;
};

const stashInfoPairs = async (pairs) => {
    const finalEntries = await replaceFinalCname(pairsToEntries(pairs));
    return getSortedByDisguisesObj(finalEntries);
};

module.exports = {
    formatFilename,
    sleep,
    sortAscending,
    getRemoved,
    getValidPairsFromRemoved,
    sortMergedInfo,
    pairsToEntries,
    stashInfoPairs,
};

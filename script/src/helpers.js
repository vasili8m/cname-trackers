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

const validateCname = async (disguise, tracker) => {
    let isValid;
    try {
        const result = await dnsPromises.resolveCname(disguise);
        isValid = result && result.includes(tracker);
    } catch (e) {
        isValid = false;
    }
    return isValid;
};

const getValidPairsFromRemoved = async (removedInfo) => {
    const validInfo = await Promise.all(Object.entries(removedInfo)
        .map(async ([disguise, tracker]) => {
            const isValid = await validateCname(disguise, tracker);
            return isValid ? { disguise, tracker } : null;
        })
        // filter nulls after cname validation
        .filter((r) => r));
    return validInfo;
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

const stashInfoPairs = (pairs) => Object.fromEntries(pairsToEntries(pairs));

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

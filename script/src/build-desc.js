const { sortAscending } = require('./helpers');

const buildDesc = async (trackersInfo, predefinedDomains) => {
    const {
        company_name: companyName,
        domains,
    } = trackersInfo;

    const flattedCloakedTrackers = domains
        .flatMap(({ cloaked_trackers: cloakedTrackers }) => cloakedTrackers)
        .filter((i) => i);

    const cloakedTrackersDomains = flattedCloakedTrackers.map(({ tracker }) => tracker);

    const passedInfoDomains = domains.map(({ domain_name: domainName }) => domainName);
    const knowsDomains = passedInfoDomains.filter((el) => predefinedDomains.includes(el));

    const domainsString = knowsDomains.map((domainName) => {
        const subDomains = cloakedTrackersDomains.filter((domain) => {
            if (domainName === domain) {
                return false;
            }
            // do not consider 'aca.ca-eulerian.net' as a subdomain for 'eulerian.net'
            return domain.endsWith(`.${domainName}`);
        });

        const uniqSubdomains = [...new Set(subDomains)];

        const subDomainsString = uniqSubdomains.sort().map((subDomain) => `    * ${subDomain}`).join('\n');

        if (subDomains.length > 0) {
            return `* ${domainName}
${subDomainsString}`;
        }
        return `* ${domainName}`;
    }).join('\n');

    const rareDomains = passedInfoDomains.filter((el) => !predefinedDomains.includes(el));
    let rareDomainsString = '';

    if (rareDomains.length) {
        const rareDomainsListString = rareDomains
            .map((el) => `* ${el}`)
            .join('\n');
        rareDomainsString = `
### Rarely active trackers

${rareDomainsListString}
`;
    }

    const cloakedTrackersString = flattedCloakedTrackers
        .sort((a, b) => {
            let res = sortAscending(a.tracker, b.tracker);
            if (res === 0) {
                res = sortAscending(a.disguise, b.disguise);
            }
            return res;
        })
        .map(({ disguise, tracker }) => `| ${disguise} | ${tracker} |`).join('\n');

    const mdString = `# Tracker: ${companyName}

## Disguised trackers list

${domainsString}
${rareDomainsString}
## Cloaking domains

| Disguise | Tracker |
| ---- | ---- |
${cloakedTrackersString}
`;

    return mdString;
};

module.exports = { buildDesc };

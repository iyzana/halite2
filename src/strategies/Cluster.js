const Geometry = require("../hlt/Geometry");

const distFunc = (a, b) => Geometry.distance(a, b);
const maxSingleLinkDist = 6;
const maxCompleteLinkDist = 15;

function cluster(points) {
    let nextId = 0;
    const clusters = new Map(points.map(p => [nextId++, [p]]));
    const distanceMap = new Map();

    clusters.forEach((cluster1, id1) => {
        distanceMap.set(id1, new Map());

        clusters.forEach((cluster2, id2) => {
            if (id1 === id2)
                return;

            const dist = distFunc(cluster1[0], cluster2[0]);

            distanceMap.get(id1).set(id2, {
                minDist: dist,
                maxDist: dist
            });
        });
    });

    let nearestIds = nearestClusters(distanceMap);

    while (nearestIds !== undefined) {
        merge(nearestIds[0], nearestIds[1], clusters, distanceMap);

        nearestIds = nearestClusters(distanceMap);
    }

    return Array.from(clusters.values());
}

function nearestClusters(distanceMap) {
    let minDist = Infinity;
    let minValue = undefined;

    distanceMap.forEach((cluster1Map, id1) => {
        cluster1Map.forEach((distances, id2) => {
            // only check from one side
            if (!(id1 < id2))
                return;

            if (distances.minDist > maxSingleLinkDist)
                return;
            if (distances.maxDist > maxCompleteLinkDist)
                return;

            if (distances.maxDist < minDist) {
                minDist = distances.maxDist;
                minValue = [id1, id2];
            }
        });
    });

    return minValue;
}

function merge(id1, id2, clusters, distanceMap) {
    if (!(id1 < id2))
        throw "merging in upper half";

    const union = clusters.get(id1).concat(clusters.get(id2));
    clusters.set(id1, union);
    clusters.delete(id2);

    const distancesFrom1 = distanceMap.get(id1);
    const distancesFrom2 = distanceMap.get(id2);

    distancesFrom1.delete(id2);
    distanceMap.delete(id2);

    distancesFrom1.forEach((distance13, id3) => {
        const distance23 = distancesFrom2.get(id3);

        const updatedDistance = {
            minDist: Math.min(distance13.minDist, distance23.minDist),
            maxDist: Math.max(distance13.maxDist, distance23.maxDist)
        };
        distancesFrom1.set(id3, updatedDistance);

        distanceMap.get(id3).set(id1, updatedDistance);
        distanceMap.get(id3).delete(id2);
    });

}

module.exports = cluster;
const Geometry = require("../hlt/Geometry");

const distFunc = (a, b) => Geometry.distance(a, b);
const maxSingleLinkDist = 5;
const maxCompleteLinkDist = 25;

function cluster(points) {
    let nextId = 0;
    const clusters = new Map(points.map(p => [nextId++, [p]]));
    const distanceMap = new Map();

    // build distance map
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

    // filter out points, that can never fulfill maxSingleLinkDist
    distanceMap.forEach((cluster1Map, id1) => {
        let useless = true;
        for (const [id2, distances] of cluster1Map.entries()) {
            if (distances.minDist <= maxSingleLinkDist) {
                useless = false;
                break;
            }
        }

        if (useless) {
            console.log("useless");
            distanceMap.delete(id1);
            distanceMap.forEach(cluster3Map => {
                cluster3Map.delete(id1);
            });
        }
    });

    let nearestIds = nearestClusters(distanceMap, clusters);

    while (nearestIds !== undefined) {
        merge(nearestIds[0], nearestIds[1], clusters, distanceMap);

        nearestIds = nearestClusters(distanceMap, clusters);
    }

    return Array.from(clusters.values());
}

function nearestClusters(distanceMap, clusters) {
    let minDist = Infinity;
    let minValue = undefined;

    distanceMap.forEach((cluster1Map, id1) => {
        cluster1Map.forEach((distances, id2) => {
            // only check from one side
            if (!(id1 < id2))
                throw "searching in upper half";

            if (distances.minDist > maxSingleLinkDist)
                return;
            if (distances.maxDist > maxCompleteLinkDist)
                return;
            if (distances.minDist >= minDist)
                return;
            const newSize = clusters.get(id1).length + clusters.get(id2).length;
            const density = newSize / distances.maxDist;
            if (density <= Math.pow(newSize, 0.7) / 8)
                return;

            minDist = distances.minDist;
            minValue = [id1, id2];
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

    distancesFrom1.delete(id2);
    distanceMap.delete(id2);

    distancesFrom1.forEach((distance13, id3) => {
        const smaller = id2 < id3 ? id2 : id3;
        const bigger = id2 > id3 ? id2 : id3;
        const distance23 = distanceMap.get(smaller).get(bigger);

        const updatedDistance = {
            minDist: Math.min(distance13.minDist, distance23.minDist),
            maxDist: Math.max(distance13.maxDist, distance23.maxDist)
        };
        distancesFrom1.set(id3, updatedDistance);

        distanceMap.get(smaller).delete(bigger);
    });
}

module.exports = cluster;
Array.prototype.toString = function () {
    return "[" + this.join(", ") + "]";
};

Array.prototype.flatMap = function (lambda) {
    return Array.prototype.concat.apply([], this.map(lambda));
};

Array.prototype.groupBy = function (keyFunction) {
    const groups = {};
    this.forEach(function (el) {
        const key = keyFunction(el);
        if (key in groups === false) {
            groups[key] = {key: key, values: []};
        }
        groups[key].values.push(el);
    });
    return Object.keys(groups).map(function (key) {
        return {
            key: groups[key].key,
            values: groups[key].values
        };
    });
};

Array.prototype.toMap = function() {
    return new Map(this);
};
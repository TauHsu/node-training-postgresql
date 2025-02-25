function isUndefined(value){
    return value === undefined;
};
function isNotValidString(value){
    return typeof value !== 'string' || value === "" || value.trim().length === 0;
};
function isNotValidInteger(value){
    return typeof value !== 'number' || value < 0 || value % 1 !== 0;
};

function isNotValidUrl(url){
    return !/^(https:\/\/)([a-zA-Z0-9.-]+)(\.[a-zA-Z]{2,})(\/.*)?$/.test(url);
};

module.exports = {
    isUndefined,
    isNotValidString,
    isNotValidInteger,
    isNotValidUrl
};
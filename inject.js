function getStorage() {
    var obj = {};

    if (storage === undefined) {
        return;
    }

    var specialKeys = [
        'length', 'key', 'getItem',
        'setItem', 'removeItem', 'clear'
    ];
    // console.log("storage---", storage)
    for (var i in storage) {
        if (storage.hasOwnProperty(i)) {
            obj[i] = storage.getItem(i);
        }
    }

    var item;
    for (var i in specialKeys) {
        item = storage.getItem(specialKeys[i]);
        if (item !== null) {
            obj[specialKeys[i]] = item;
        }
    }
    // console.log("obj---", obj)
    return obj;
}


var storage = msg.type === 'Local' ? localStorage : sessionStorage;
var result;
var test

switch (msg.what) {

    case 'get':
        result = getStorage();
        // console.table('????', result);
        break;

    case 'remove':
        storage.removeItem(msg.key);
        break;

    case 'set':
        // changing key?
        if (msg.oldKey !== undefined) {
            storage.removeItem(msg.oldKey);
        }

        storage.setItem(msg.key, msg.value);
        break;

    case 'clear':
        storage.clear();
        break;

    case 'export':
        result = JSON.stringify(getStorage(), null, 4);
        break;
}

result;


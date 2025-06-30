const fs = require('fs');

const json = require('./credentials.json');
json.private_key = json.private_key.replace(/\n/g, '\\n');

console.log(JSON.stringify(json));

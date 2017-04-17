const {Wit, log} = require('node-wit')

module.exports.witQuery = (question, cb) => {
    let client = new Wit({accessToken: '5OG4BVJAIVCBAN357AGTDZX5BE6EWXM2'});
    
    client.message(question, {}).then(data => {
        cb(true, data);
        console.log(`wit reply: ${JSON.stringify(data, null, 4)}`);
    }).catch(error => {
        cb(false, error);
        console.error(`wit error: ${error}`);
    });
}

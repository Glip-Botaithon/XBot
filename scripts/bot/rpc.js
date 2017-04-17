var xmlrpc = require('xmlrpc')

class RpcClient {
    constructor(config) {
        this.config = config;
        this.client = xmlrpc.createClient({
            host: config.host,
            port: config.port,
            path: config.path || '/RPC2'
        })
    }

    startService(serviceName, cb) {
        this.client.methodCall('supervisor.startProcess', [serviceName], cb);
    }

    stopService(serviceName, cb) {
        this.client.methodCall('supervisor.stopProcess', [serviceName], cb);
    }

    getServiceStatus(serviceName, cb) {
        this.client.methodCall('supervisor.getProcessInfo', [serviceName], cb);
    }

    getAllServicesStatus(cb) {
        this.client.methodCall('supervisor.getAllProcessInfo', [], cb);
    }

    readProcessStdout(sn, cb) {
        this.client.methodCall('supervisor.tailProcessStdoutLog', [sn, 0, 1024], cb);
    }

    readProcessStderr(sn, cb) {
        // this.client.methodCall('supervisor.tailProcessStdoutLog', [sn, 0, 1024], cb);
        this.client.methodCall('supervisor.tailProcessStderrLog', [sn, 0, 1024], cb);
        // this.client.methodCall('supervisor.tailProcessStderrLog', [sn, 0, 1024], cb);
    }

    static getAllHostServicesStatus(hosts, cb) {
        let promises = hosts.map(h => {
            console.log(h);
            let client = new RpcClient(h);

            return new Promise((resolve, reject) => {
                client.getAllServicesStatus((error, data) => {
                    let retData = data.map(s => Object.assign(s, {host: h}));
                    resolve(data);
                })
            });
        });

        Promise.all(promises).then(results => {
            let slist = results.reduce((a, b) => a.concat(b));
            cb(false, slist);
        }).catch(error => {
            cb(true,`error getting all services status: ${error}!`);
        });
    }

    listMethods(cb) {
        this.client.methodCall('system.listMethods', [], cb);
    }
}

module.exports = RpcClient;

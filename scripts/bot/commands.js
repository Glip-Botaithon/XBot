var states = require('./states');
var hosts = require('./s.json');
var RpcClient = require('./rpc')
const {witQuery} = require('./wit')
var Table = require('easy-table');

class BaseCommand {
    constructor(res, msg, robot) {
        this.res = res;
        this.msg = msg;
        this.robot = robot;
    }

    getUserData() {
        let key = `${this.res.message.user.id}_data`;
        let data = this.robot.brain.get(key);
        
        return data;
    }

    setUserData(data) {
        let key = `${this.res.message.user.id}_data`;
        this.robot.brain.set(key, data);
    }

    getUserState() {
        let userId = this.res.message.user.id;
        let status = this.robot.brain.get(userId) || states.INIT;
        
        return status;
    }

    setUserState(state) {
        let userId = this.res.message.user.id;
        this.robot.brain.set(userId, state);
    }

    parseServiceName(serviceName) {
        let pattern = /([^\s]+)_([^\s]+)/;

        if (!pattern.test(serviceName)) {
            return undefined;
        }

        let match = pattern.exec(serviceName);

        return {
            hName: match[1],
            sName: match[2]
        }
    }

    findHost(host) {
        return hosts.find(h => h.name == host);
    }

    checkServiceName(sn) {
        let pRet = this.parseServiceName(sn);

        if (!pRet || !this.findHost(pRet.hName)) {
            return {succ: false, msg: `service ${sn} no found!`};
        }

        return {
            succ: true,
            hostConfig: this.findHost(pRet.hName),
            sName: pRet.sName, 
            hName: pRet.hName
        }
    }

    execute() {
        this.res.send('no implemented!');
    }
}

class MatchCommand extends BaseCommand {
    getParamaters() {
        return this.constructor.pattern.exec(this.msg).slice(1);
    }
   
    execute() {
        let args = this.getParamaters();

        args.forEach(sn => {
            let cRet = this.checkServiceName(sn);

            if (!cRet.succ) {
                this.res.send(cRet.msg);
                return;
            }

            let client = new RpcClient(cRet.hostConfig);
            this.doExecute(client, cRet.hName, cRet.sName);
        });
    }
}

class LogCommand extends MatchCommand {
    static get pattern() {
        return /^log\s+([^\s]+)$/i;
    }

    doExecute(client, hName, sName) {
        client.readProcessStdout(sName, (err, data) => {
            if (err) {
                console.error(err);
                this.res.send(`failed to read service log!`);
                return;
            }

            if (data[0].length == 0) {
                this.res.send(`no log output for this service!`)
                return;
            }

            this.res.send(data[0]);
        });
    }
}

class ErrorLogCommand extends MatchCommand {
    static get pattern() {
        return /^error log\s+([^\s]+)$/i;
    }

    doExecute(client, hName, sName) {
        client.readProcessStderr(sName, (err, data) => {
            if (err) {
                console.error(err);
                this.res.send(`failed to get service error log!`);
                return;
            }

            if (data[0].length == 0) {
                this.res.send(`not error log now!`);
                return;
            }

            this.res.send(data[0]);
        });
    }
}

class StopCommand extends MatchCommand {
    static get pattern() {
        return /^stop\s+(.+)/i;
    }

    doExecute(client, hName, sName) {
        client.stopService(sName, (err, ret) => {
            if (err || !ret) {
                let msg = `failed to stop service ${hName}_${sName}`;

                if (err && err.faultCode == 70) {
                    msg = `${msg}, service is no running!`;
                }

                console.error(err);
                this.res.send(msg);
            } else {
                this.res.send(`service ${hName}_${sName} stopped!`);
            }
        });
    }
}

class StartCommand extends MatchCommand {
    static get pattern() {
        return /^start\s+(.+)/i;
    }

    doExecute(client, hName, sName) {
        client.startService(sName, (err, ret) => {
            let sn = `${hName}_${sName}`;

            if (!err && ret) {
                this.res.send(`service ${sn} started!`);
                return;
            }

            let msg = `failed to start service ${sn}`;
            if (err) {
                console.error(err);

                if (err.faultCode == 60) {
                    msg = `${msg}, services already started!`;
                }
            }

            this.res.send(msg);
        });
    }
}

class TailLogCommand extends MatchCommand {
    static get pattern() {
        return /^tail\s+log\s+([^\s]+)$/i
    }

    tailLog(client, hName, sName, offset) {
        client.client.methodCall('supervisor.tailProcessStdoutLog', [sName, offset, 64], (err, data) => {
            if (err) {

            } else {
                if (offset == 0) {
                    this.res.send(data[0]);
                } else {
                    let sz = data[1] - offset;

                    if (sz > 0) {
                        let d = data[0].slice(data[0].length - sz);
                        this.res.send(d);
                        // console.log(data[0].slice(data[0].length - sz));
                        // console.log(data[2])
                    }
                }

                setTimeout(() => this.tailLog(client, hName, sName, data[1]), 5000);
            }
        });
    }

    doExecute(client, hName, sName) {
        this.tailLog(client, hName, sName, 0);
    }
}

class EndTailLogCommand extends MatchCommand {

}

class TailErrorLogCommand extends MatchCommand {

}

class EndTailErrorLogCommand extends MatchCommand {

}


class StatusCommand extends MatchCommand {
    static get pattern() {
        return /^status\s(.+)$/i;
    }

    doExecute(client, hName, sName) {
        client.getServiceStatus(sName, (err, ret) => {
            console.log(`error: ${err}, ret: ${ret}`);
            this.res.send(`service ${hName}_${sName} is ${ret.statename} now.`);
        })
    }
}

class ListServicesCommand extends BaseCommand {
    static get pattern() {
        return /^list\s+services/i;
    }

    execute() {
        RpcClient.getAllHostServicesStatus(hosts, (error, data) => {
            if (error) {
                this.res.send(data);
            } else {
                let table = new Table();
                data.forEach(s => {
                    table.cell('name', `${s.host.name}_${s.name}`);
                    table.cell('state', s.statename);
                    table.cell('description', s.description);
                    table.newRow();
                });

                console.log(table.toString());
                let retMsg = `\`\`\`java
${table.toString()}\`\`\``;
                this.res.send(retMsg);
            }
        });
    }
}

class HelpCommand extends BaseCommand {
    static get pattern() {
        return /^X\shelp$/i;
    }

    getHelpMsg() {
        let msg = `\`\`\`java
Hi, I am X Bot, your most humble servant,
I can help control your services, I can:

1. start service
2. stop service
3. check servide status
4. check service log and error log
5. list all services under my control

You can talk me in human language(but
English only now), say, if you want me 
to list all the services that is currently
under my control, you can just type:

X show me all the services

Any further questions, just contact
vince.wu@ringcentral.com or
bree.lu@ringcentral.com
\`\`\``; 

        return msg;
    }

    execute() {
        this.res.send(this.getHelpMsg());
    }
}

class FuzzyCommand extends BaseCommand {
    parseUserQuery(query, cb) {
        RpcClient.getAllHostServicesStatus(hosts, (error, data) => {
            if (error) {
                cb(error, data);
            } else {
                let sset = new Set(query.split(/[\s,]+/));
                let services = data.map(s => `${s.host.name}_${s.name}`);
                let selectedServices = services.filter(sn => sset.has(sn));

                cb(error, selectedServices);
            }
        });
    }

    execute() {
        witQuery(this.msg, (succ, data) => {
            let intents = data.entities.intent;

            console.log(JSON.stringify(data, null, 4));

            if (!intents) {
                new HelpCommand(this.res, this.msg, this.robot).execute();
                this.setUserState(states.INIT);

                return;
            }

            let intent = intents[0];

            if (intent.value == 'help') {
                new HelpCommand(this.res, this.msg, this.robot).execute();
            } else if (intent.value == 'list_services') {
                new ListServicesCommand(this.res, this.msg, this.robot).execute();
            } else if (intent.value == 'start') {
                this.parseUserQuery(this.msg, (error, data) => {
                    if (error || data.length == 0) {
                        this.res.send(`please specify at least one existing services that you want to start!`);
                    } else {
                        this.res.send(`do you want to start services: ${data.join(', ')}?`);
                        this.setUserData(JSON.stringify(data));
                        this.setUserState(states.START);
                    }
                });
            } else if (intent.value == 'stop') {
                this.parseUserQuery(this.msg, (error, data) => {
                    if (error || data.length == 0) {
                        this.res.send(`please specify at least one existing services that you want to start!`);
                    } else {
                        this.res.send(`do you want to stop services: ${data.join(', ')}?`);
                        this.setUserData(JSON.stringify(data));
                        this.setUserState(states.STOP);
                    }
                });
            } else if (intent.value == 'status') {
                this.parseUserQuery(this.msg, (error, data) => {
                    if (error || data.length == 0) {
                        this.res.send(`please specify at least one existing services that you want to check status!`);
                    } else {
                        data.forEach(s => {
                            new StatusCommand(this.res, `status ${s}`, this.robot).execute();
                        });
                    }
                });
            } else if (intent.value == 'log') {
                this.parseUserQuery(this.msg, (error, data) => {
                    if (error || data.length == 0) {
                        this.res.send(`please specify at least one existing services that you want to check log!`);
                    } else {
                        data.forEach(s => {
                            new LogCommand(this.res, `log ${s}`, this.robot).execute();
                        });
                    }
                });
            } else if (intent.value == 'error_log') {
                this.parseUserQuery(this.msg, (error, data) => {
                    if (error || data.length == 0) {
                        this.res.send(`please specify at least one existing services that you want to check log!`);
                    } else {
                        data.forEach(s => {
                            new ErrorLogCommand(this.res, `error log ${s}`, this.robot).execute();
                        });
                    }
                });
            } else if (intent.value == 'yes') {
                let state = this.getUserState();
                let data = this.getUserData()

                if (!data) {
                    console.error('no services specified!');
                    return;
                }

                data = JSON.parse(data);

                if (state == states.START) {
                    data.forEach(s => {
                        let msg = `start ${s}`;
                        new StartCommand(this.res, msg, this.robot).execute();
                    });
                } else if (state == states.STOP) {
                    data.forEach(s => {
                        let msg = `stop ${s}`;
                        new StopCommand(this.res, msg, this.robot).execute();
                    });
                } else {
                    console.error(`unknown user status: ${this.getUserState()}`);
                }
            } else if (intent.value == 'no') {
                if (this.getUserState() != states.INIT) {
                    this.res.send('ok, task canceled!');
                }
            }

            this.setUserState(states.INIT);
        });
    }
}

let commands = [
    ListServicesCommand,
    StopCommand,
    StartCommand,
    StatusCommand,
    HelpCommand,
    LogCommand,
    ErrorLogCommand,
    TailLogCommand,
];

module.exports = {
    FuzzyCommand,
    commands
};

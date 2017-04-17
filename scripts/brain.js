// Description:
//   Brain of XBot

var {commands, FuzzyCommand} =  require('./bot/commands');

cleanMsg = (msg) => {
    return msg.replace(/X\s+/, '');
}

module.exports = robot => {
    robot.respond(/.+/, res => {
        console.log(`msg: ${res.match[0]}`);
        let msg = cleanMsg(res.match[0]);
        let Command = commands.find(cmd => cmd.pattern.test(msg));

        if (!Command) {
            // let cmd = new match.Command(res, res.match[0], robot);
            console.log(`no matching command of msg ${msg} found!`);
            Command = FuzzyCommand;
        }

        let cmd = new Command(res, msg, robot);
        cmd.execute();
    });
}

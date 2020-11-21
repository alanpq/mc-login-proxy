const mc = require("minecraft-protocol");
const states = mc.states;
const fs = require("fs");
const bcrypt = require("bcrypt")
const saltRounds = 10;

const w = require('./serverConsts').w
const dimension = require('./serverConsts').dimension
const mcData = require('minecraft-data')('1.16.4')

if(!fs.existsSync("passwords.json")) {
    console.error("No passwords.json file! I can't be assed making this auto gen so make it please (same dir as index.js).")
    console.error("oh yeah also make sure the file contains '{}' :3")
    process.exit(1);
}
// hehehehehehehehehehehehehehehehehehehe
const passwords = JSON.parse(fs.readFileSync("passwords.json", 'utf-8'));

const savePwds = () => {
    const today = new Date();
    fs.copyFile("passwords.json", `pwds${today.getUTCFullYear()}-${(today.getUTCMonth()+1).toString(10).padStart(2, '0')}-${today.getUTCDate()}.bak`, (err) => {
        if(err) {
            console.error('Failed to create backup password file!')
            console.error('hope uh the passwords are ok, would suck if both backup failed and also password save failed :3')
        }
        fs.writeFile("passwords.json", JSON.stringify(passwords), (err) => {
            if(err) {
                console.error('yo something really bad with the passwords happened:')
                console.error(err);
                console.error('imma dump all the passwords here just in case:')
                console.error('----------------------------')
                console.error(JSON.stringify(passwords))
            }
        });
    })
}

const srv = mc.createServer({
    port: 25565,
    keepAlive: false,
    "online-mode": false,
    version: "1.16.4",
    //favicon: fs.readFileSync("./image.b64", "utf8"),
    motd: "§dteehee§6:3",
    "max-players": 6969
});



const send_chat = (client, msg, events={}) => {
    var m = {
        text: msg
    }

    for (var event in events) {
        m[event] = events[event];
    }

    client.write("chat", { message: JSON.stringify(m), position: 0, sender: '0' });
}

srv.on('login', async function (client) {
    client.custom_authed = false;
    send_chat(client, (passwords[client.username] ? "§dplease enter your password" : "§dplease enter a password (remember it and all)"), {
        // hoverEvent: { action: "show_text", value: "https://millionware.vip/api/mc/auth/" + client.token },
        // clickEvent: { action: "open_url", value: "https://millionware.vip/api/mc/auth/" + client.token }
    });

    // client.auth_interval = setInterval(async () => {
    //     client.mw_authenticated = nope;

    //     if (client.mw_authenticated >= 1) {
    //         if (client.mw_authenticated == 2) {
    //             send_chat(client, "§dlooks like it's your first time here");
    //             send_chat(client, "§dthis minecraft username was linked to your account. so no alts allowed, also no one will be able to access your account.");
    //         }
    //         client.mw();
    //         clearInterval(client.auth_interval);
    //     }
    // }, 1000);

    client.on("chat", async (packet) => {
        if(client.custom_authed) return;
        const msg = packet.message;
        // const pwdattempt = msg.text.with.join(" ");
        if(!passwords[client.username]) {
            // console.log(`Unregistered user '${client.username}' tried to login!`)
            bcrypt.hash(msg, saltRounds, (err, hash) => {
                send_chat(client, "You have been registered successfully!")
                passwords[client.username] = hash;
                savePwds();
            })
        } else {
            bcrypt.compare(msg, passwords[client.username] || "").then((comparison) => {
                if(comparison) {
                    send_chat(client, "Logged in successfully!")
                    client.custom_authed = true;
                    client.customAuth();
                } else {
                    send_chat(client, "wrong password")
                }
            })
        }
    })

    client.on("end", () => { clearInterval(client.auth_interval) });

    client.write('login', {
        uuid: client.uuid,
        entityId: client.id,
        levelType: 'default',
        gameMode: 0,
        previousGameMode: 255,
        worldNames: ['minecraft:overworld'],
        dimensionCodec: mcData.loginPacket.dimensionCodec,
        dimension: mcData.loginPacket.dimension,
        // dimensionCodec: { 
        //     name: '',
        //     type: 'compound',
        //     value: w
        // },
        // dimension,
        worldName: 'minecraft:overworld',
        worldNames: ["minecraft:overworld", "minecraft:the_nether", "minecraft:the_end"],
        difficulty: 2,
        hashedSeed: [0, 0],
        maxPlayers: 20,
        reducedDebugInfo: false,
        enableRespawnScreen: true,
        isDebug: false,
        isFlat: false,
        isHardcode: false,
        viewDistance: 0,
    });

    client.write('position', {
        x: 69,
        y: 69,
        z: 69,
        yaw: 0,
        pitch: 0,
        flags: 0x00
    });

    client.on("error", () => { });

    client.customAuth = () => {
        const targetClient = mc.createClient({
            host: "127.0.0.1",
            port: 25566,
            username: client.username,
            keepAlive: false,
            version: "1.16.4",
        });
        targetClient.on("error", (err) => { 
            console.error(err)
        });
        client.on('packet', function (data, meta) {
            if (targetClient.state === states.PLAY && meta.state === states.PLAY) {
                targetClient.write(meta.name, data);
            }
        })

        targetClient.on('packet', function (data, meta) {
            if (meta.name == "login" || meta.name == "respawn") {
                if (meta.name == "login") {
                    var dim = data.dimension;
                    var wrd = data.worldName;
                    // data.dimension = "minecraft:overworld";
                    data.worldName = "minecraft:overworld";

                    client.write("login", data);

                    client.write("respawn", {
                        dimension: dim,
                        worldName: wrd,
                        hashedSeed: [0, 0],
                        gamemode: 0,
                        previousGamemode: 1,
                        isDebug: false,
                        isFlat: false,
                        copyMetadata: true
                    });

                    setTimeout(() => { client.bruh = true }, 500);
                }

                if (!client.bruh)
                    return;
            }

            //console.log(meta.name);

            if (meta.state === states.PLAY && client.state === states.PLAY) {
                client.write(meta.name, data)
                if (meta.name === "set_compression") {
                    client.compressionThreshold = data.threshold
                }
            }
        })

        client.on("end", (reason) => { targetClient.end(reason); });
        targetClient.on("end", (reason) => { client.end(reason); });
    };
})
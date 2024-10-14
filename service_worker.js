let ws
let retry = 0
function connect() {
    ws = new WebSocket("wss://gomoku.cc:4001")

    ws.addEventListener("close", () => {
        console.log("Disconnected...")
        setTimeout(() => {
            connect()
        }, retry)
        retry += 5000
    })

    ws.addEventListener("open", () => {
        retry = 0
    })

    ws.addEventListener("message", e => {
        let data
        try {
            data = JSON.parse(e.data)
        } catch (e) {
            console.error(e)
            return;
        }
        let action = data.action;
        switch (action) {
            case "message":
                message(data.message, data.sender, data.mode)
                try {
                    chrome.runtime.sendMessage(data).then(_ => {})
                } catch (_) {}
                return
        }
        if (data.handler !== undefined) {
            let handler = data.handler
            if (handlers[handler]) {
                handlers[handler](data);
                handlers[handler] = undefined
                let clear = true
                for (const r of handlers) {
                    if (r !== undefined) {
                        clear = false
                    }
                }
                if (clear) {
                    handlers.splice(0)
                }
            }
        }
    })
}
connect()

class Message {
    message; sender; timestamp; mode;
    constructor(message, sender, mode) {
        this.message = message;
        this.sender = sender;
        this.timestamp = Date.now();
        this.mode = mode;
    }
}
const MessageType = {
    SELF_MESSAGE: 0,
    MEMBER_MESSAGE: 1,
    MEMBER_LEAVE: 2,
    MEMBER_JOIN: 3,
    VIDEO_PAUSE: 4,
    VIDEO_PLAY: 5,
    VIDEO_JUMP: 6,
    VIDEO_SWITCH: 7
}
const messages = []
const handlers = []
let username, session, group, group_id, watching

chrome.storage.sync.get(["session"], s => {
    session = s.session
})
chrome.storage.sync.get(["username"], u => {
    username = u.username
})
let keepalive = undefined

function sendJson(data) {
    let promise
    if (!data.handler) {
        data.handler = handlers.length
        let r
        promise = new Promise((resolve, _) => {
            r = resolve
        })
        handlers[data.handler] = r
    }
    ws.send(JSON.stringify(data));
    return promise
}

function message(message, sender, mode, ...args) {
    messages.push(new Message(message, sender, mode));
    chrome.tabs.query({active: true}).then(tabs => {
        if (tabs.length < 1) return
        for (const tab of tabs) {
            if (!tab.url || !tab.url.match(/.*\.bilibili\.com\/video\/.*/g)) continue
            let data = {action: "message", message: message, sender: sender, mode: mode}
            data = {...data, ...args[0]}
            try {
                chrome.tabs.sendMessage(tab.id, data).then(_ => {})
            } catch (e) {
                console.warn(e)
            }
        }
    })
}
function clear_messages() {
    messages.splice(0)
}

function startHeart() {
    clearInterval(keepalive)
    keepalive = setInterval(() => {
        sendJson({mode: "heart", session: session}).then(r => {
            if (r.action !== "ok") {
                if (r.action === "invalid-session") {
                    chrome.runtime.sendMessage(r).then(_ => {})
                }
            }
        })
    }, 20000)
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    listener(request, sender).then(sendResponse)
    return true
})

async function listener(request, _) {
    let action = request.action
    let r
    switch (action) {
        case "load":
            if (session !== undefined) {
                let r = await sendJson({mode: "reconnect", session: session})
                if (r.action !== "ok") {
                    console.log(r.action)
                    if (r.action === "invalid-session") {
                        return {action: "invalid-session"}
                    }
                    return
                }
                group = r["group"]
                group_id = r["gid"]
                username = r["name"]
            }
            if (!username) {
                return {action: "need-login"}
            }
            startHeart()
            return {action: "sync-data", messages: messages, group: group, group_id: group_id, username: username}
        case "login":
            username = request.name;
            r = await sendJson({mode: "login", name: username})
            if (r.action === "ok") {
                session = r.session
                chrome.storage.sync.set({session: session, username: username}, () => {
                    console.log("User data saved.")
                })
                startHeart()
                return {action: "ok"}
            }
            return {action: r.action}
        case "send":
            r = await sendJson({mode: "send", message: request.message, session: session})
            if (r.action !== "ok") {
                console.error(r.action)
                return r
            }
            message(request.message, username, MessageType.SELF_MESSAGE)
            return {action: "ok", username: username}
        case "video":
            if (group_id === 10000) return
            r = await sendJson({mode: "video", data: request.data, type: request.type, session: session})
            if (r.action !== "ok") {
                console.error(r.action)
            }
            message(request.data, username, request.type, {self: true})
            return r
        case "active":
            return {action: "ok"}
        case "create":
            r = await sendJson({mode: "create", session: session, group_name: request.name, password: request.password})
            if (r.action === "ok") {
                group = request.name
                group_id = r.group_id
                clear_messages()
            }
            return r
        case "join":
            r = await sendJson({mode: "join", session: session, group_id: request.group_id, password: request.password})
            if (r.action === "ok") {
                group = r.group_name
                group_id = request.group_id
                clear_messages()
            }
            return r
    }
}
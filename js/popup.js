const MessageType = {
    SELF_MESSAGE: 0,
    MEMBER_MESSAGE: 1,
    MEMBER_LEAVE: 2,
    MEMBER_JOIN: 3,
    VIDEO_PAUSE: 4,
    VIDEO_PLAY: 5,
    VIDEO_SEEKED: 6,
    VIDEO_SWITCH: 7
}
const id = (i) => {
    return document.getElementById(i);
};
const msgList = id("message-list");
const msgClone = id("message-clone");
const groupName = id("group-name");
const groupId = id("group-id");
const input = id("input");

function message(message, sender, mode) {
    const clone = msgClone.cloneNode(true);
    clone.removeAttribute("id")
    if (mode === MessageType.SELF_MESSAGE || mode === MessageType.MEMBER_MESSAGE) {
        clone.querySelector(".nickname").innerText = sender;
        clone.querySelector(".message").innerText = message;
        if (mode === MessageType.SELF_MESSAGE) {
            clone.classList.add("self");
        }
    } else {
        clone.classList.add("info")
        let msg = clone.querySelector(".message")
        switch (mode) {
            case MessageType.MEMBER_LEAVE:
                msg.innerText = `${sender} 离开了`;
                break
            case MessageType.MEMBER_JOIN:
                msg.innerText = `${sender} 加入了`;
                break
            case MessageType.VIDEO_PAUSE:
                msg.innerText = `${sender} 暂停了视频`
                break
            case MessageType.VIDEO_PLAY:
                msg.innerText = `${sender} 播放了视频`
                break
            case MessageType.VIDEO_SEEKED:
                msg.innerText = `${sender} 将视频跳转到了 ${Math.round(message)}s`
                break
            case MessageType.VIDEO_SWITCH:
                msg.innerText = `${sender} 更换了视频为 ${message}`
                break
        }
    }
    msgList.appendChild(clone);
}
function clear_message() {
    msgList.innerHTML = "";
}

id("send-btn").addEventListener("click", _ => {
    let m = input.value;
    chrome.runtime.sendMessage({action: "send", message: m}).then(r => {
        console.log(r)
        if (r.action === "ok") {
            message(m, r.username, 0)
            input.value = ""
        }
    })
})

function sharp_prompt(msg, _default, warn) {

    let i = prompt(msg, _default)
    if (!i) return [null, null]
    if (i.split("#").length !== 2) {
        alert(warn)
        return [null, null]
    }
    let s = i.split("#")
    return [s[0], s[1]]
}

id("create-btn").addEventListener("click", () => {
    let [name, key] = sharp_prompt("请输入要创建的组名称和加入密钥，以 # 分隔: ", "Example#example_key", "请输入正确格式！")
    if (!name) return
    chrome.runtime.sendMessage({action: "create", name: name, password: key}).then(r => {
        if (r.action !== "ok") {
            console.error(r.action)
            return
        }
        groupName.innerText = name
        groupId.innerText = r["group_id"]
        clear_message()
    })
})

id("join-btn").addEventListener("click", () => {
    let [gid, key] = sharp_prompt("请输入要创建的组ID和加入密钥，以 # 分隔: ", "10001#example_key", "请输入正确格式！")
    if (!gid) return
    chrome.runtime.sendMessage({action: "join", group_id: gid * 1, password: key}).then(r => {
        if (r.action !== "ok") {
            switch (r.action) {
                case "group-not-found":
                    alert("该组不存在！")
                    return
                case "wrong-password":
                    alert("密码错误！")
                    return
                default:
                    console.error(r.action)
                    return
            }
        }
        groupName.innerText = r.group_name
        groupId.innerText = gid
        clear_message()
    })
})
function load() {
    chrome.runtime.sendMessage({action: "load"}).then(s => {
        if (s.action === "need-login" || s.action === "invalid-session") {
            const msg = s.action === "need-login" ? "请输入用户名：" : "登录已过期，请重新登录："
            const name = prompt(msg)
            chrome.runtime.sendMessage({action: "login", name: name}).then(r => {
                if (r.action !== "ok") {
                    if (r.action === "invalid-name") {
                        alert("请输入只包含数字、字母和半角符号的用户名！")
                        load()
                    }
                }
            })
            return
        }
        if (s.action === "sync-data") {
            groupName.innerHTML = s.group;
            groupId.innerHTML = s.group_id;
            for (const msg of s.messages) {
                message(msg.message, msg.sender, msg.mode);
            }
        }
    })
}
load()
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    listener(request, sender).then(sendResponse)
    return true
})
async function listener(request, sender) {
    let action = request.action
    switch (action) {
        case "message":
            message(request.message, request.sender, request.mode)
            return
        case "invalid-session":
            load()
    }
}
console.log("Running in BiliBili!")
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
let is_video = location.href.match(/.*\.bilibili\.com\/video\/.*/g)
let bvid = location.href.replace(/.*bilibili.com\/video\/([^?]+).*/g, "$1")
let video
if (is_video) {
    video = document.querySelector("video")
    init_video(video)
}
let master = false

chrome.runtime.sendMessage({action: "active"}).then(_ => {})

function sendVideo(data, type) {
    chrome.runtime.sendMessage({action: "video", type: type, data: data}).then(_ => {})
}

function init_video(v) {
    v.addEventListener("pause", () => {
        sendVideo(video.currentTime, MessageType.VIDEO_PAUSE)
    })

    v.addEventListener("play", () => {
        sendVideo(video.currentTime, MessageType.VIDEO_PLAY)
    })

    v.addEventListener("seeked", () => {
        sendVideo(video.currentTime, MessageType.VIDEO_SEEKED)
    })
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    listener(request, sender).then(sendResponse)
})
async function listener(request, sender) {
    let action = request.action
    let r
    console.log(request)
    switch (action) {
        case "message":
            if (request.mode === MessageType.MEMBER_MESSAGE) {
                // TODO: popup member message
                return
            }
            if (!is_video || request.self) return
            switch (request.mode) {
                case MessageType.VIDEO_PAUSE:
                    video.pause()
                    break
                case MessageType.VIDEO_PLAY:
                    video.play()
                    break
            }
            video.currentTime = request.message * 1.0
            return
    }
    return true
}
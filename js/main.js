const MessageType = {
    SELF_MESSAGE: 0,
    MEMBER_MESSAGE: 1,
    MEMBER_LEAVE: 2,
    MEMBER_JOIN: 3,
    VIDEO_PAUSE: 4,
    VIDEO_PLAY: 5,
    VIDEO_SEEKED: 6,
    VIDEO_SWITCH_VIDEO: 7,
    VIDEO_SWITCH_BANGUMI: 8
}
const VideoType = {
    NOT_VIDEO: 0,
    VIDEO: 1,
    BANGUMI: 2
}
let video_r = /https?:\/\/.*\.bilibili\.com\/video\/([^?/]+).*/g
let bangumi_r = /https?:\/\/.*\.bilibili\.com\/bangumi\/play\/([^?/]+).*/g
let is_video = location.href.match(video_r)
let video_id = location.href.replace(video_r, "$1")
let is_bangumi = location.href.match(bangumi_r)
if (is_bangumi) {
    video_id = location.href.replace(bangumi_r, "$1")
}
let video_type = (is_video || is_bangumi) ? (is_video ? VideoType.VIDEO : VideoType.BANGUMI) : VideoType.NOT_VIDEO

let video
function get_video() {
    if (video_type !== VideoType.NOT_VIDEO) {
        video = document.querySelector("video")
        init_video(video)
    }
}
get_video()
window.onloadedmetadata = function () {
    if (!video) {
        get_video()
    }
}
let master = false

function sendVideo(data, type) {
    chrome.runtime.sendMessage({action: "video", type: type, data: data}).then(_ => {})
}
if (video_type !== VideoType.NOT_VIDEO) {
    sendVideo(video_id, is_video ? MessageType.VIDEO_SWITCH_VIDEO : MessageType.VIDEO_SWITCH_BANGUMI)
}

function init_video(v) {
    if (!v) return
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
            if (request.self) return
            if (request.mode === MessageType.VIDEO_SWITCH_VIDEO || request.mode === MessageType.VIDEO_SWITCH_BANGUMI) {
                if (request.message === video_id) return
                let prefix = "https://www.bilibili.com/"
                if (request.mode === MessageType.VIDEO_SWITCH_VIDEO) {
                    location.href = prefix + "video/" + request.message
                } else {
                    location.href = prefix + "bangumi/play/" + request.message
                }
                return
            }
            if (video_type === VideoType.NOT_VIDEO) return
            switch (request.mode) {
                case MessageType.VIDEO_PAUSE:
                    video.pause()
                    break
                case MessageType.VIDEO_PLAY:
                    video.play()
                    break
            }
            let time = request.message * 1.0
            if (Math.abs(time - video.currentTime) > 5) {
                video.currentTime = time
            }
            return
    }
    return true
}

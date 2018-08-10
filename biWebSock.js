window.biWebSock = (function() {
    var dataStruct = [{
        name: "Header Length",
        key: "headerLen",
        bytes: 2,
        offset: 4,
        value: 16
    }, {
        name: "Protocol Version",
        key: "ver",
        bytes: 2,
        offset: 6,
        value: 1
    }, {
        name: "Operation",
        key: "op",
        bytes: 4,
        offset: 8,
        value: 1
    }, {
        name: "Sequence Id",
        key: "seq",
        bytes: 4,
        offset: 12,
        value: 1
    }]

    var protocol = location.origin.match(/^(.+):\/\//)[1]

    var wsUrl = 'ws://broadcastlv.chat.bilibili.com:2244/sub'

    if (protocol === 'https') {
        wsUrl = 'wss://broadcastlv.chat.bilibili.com:2245/sub'
    }

    function str2bytes(str) {
        var bytes = new Array()
        var len, c
        len = str.length
        for (var i = 0; i < len; i++) {
            c = str.charCodeAt(i)
            if (c >= 0x010000 && c <= 0x10FFFF) {
                bytes.push(((c >> 18) & 0x07) | 0xF0)
                bytes.push(((c >> 12) & 0x3F) | 0x80)
                bytes.push(((c >> 6) & 0x3F) | 0x80)
                bytes.push((c & 0x3F) | 0x80)
            } else if (c >= 0x000800 && c <= 0x00FFFF) {
                bytes.push(((c >> 12) & 0x0F) | 0xE0)
                bytes.push(((c >> 6) & 0x3F) | 0x80)
                bytes.push((c & 0x3F) | 0x80)
            } else if (c >= 0x000080 && c <= 0x0007FF) {
                bytes.push(((c >> 6) & 0x1F) | 0xC0)
                bytes.push((c & 0x3F) | 0x80)
            } else {
                bytes.push(c & 0xFF)
            }
        }
        return bytes
    }

    function bytes2str(array) {
        var __array = array.slice(0)
        var j
        var filterArray = [
            [0x7f],
            [0x1f, 0x3f],
            [0x0f, 0x3f, 0x3f],
            [0x07, 0x3f, 0x3f, 0x3f]
        ]
        var str = ''
        for (var i = 0; i < __array.length; i = i + j) {
            var item = __array[i]
            var number = ''
            if (item >= 240) {
                j = 4
            } else if (item >= 224) {
                j = 3
            } else if (item >= 192) {
                j = 2
            } else if (item < 128) {
                j = 1
            }
            var filter = filterArray[j - 1]
            for (var k = 0; k < j; k++) {
                var r = (__array[i + k] & filter[k]).toString(2)
                var l = r.length
                if (l > 6) {
                    number = r
                    break
                }
                for (var n = 0; n < 6 - l; n++) {
                    r = '0' + r
                }
                number = number + r
            }
            str = str + String.fromCharCode(parseInt(number, 2))
        }
        return str
    }

    function getPacket(payload) {
        return str2bytes(payload)
    }

    function generatePacket(action, payload) {
        action = action || 2 // 2心跳  或  7加入房间
        payload = payload || ''
        var packet = getPacket(payload)
        var buff = new ArrayBuffer(packet.length + 16)
        var dataBuf = new DataView(buff)
        dataBuf.setUint32(0, packet.length + 16)
        dataBuf.setUint16(4, 16)
        dataBuf.setUint16(6, 1)
        dataBuf.setUint32(8, action)
        dataBuf.setUint32(12, 1)
        for (var i = 0; i < packet.length; i++) {
            dataBuf.setUint8(16 + i, packet[i])
        }
        return dataBuf
    }

    function Room() {
        this.timer = null
        this.socket = null
        this.roomid = null
    }

    Room.prototype = {
        sendBeat: function() {
            var self = this
            self.timer = setInterval(function () {
                self.socket.send(generatePacket())
            }, 3000)
        },
        destroy: function() {
            clearTimeout(this.timer)
            this.socket.close()
            this.socket = null
            this.timer = null
            this.roomid = null
        },
        joinRoom: function(rid, uid) {
            rid = rid || 22557
            uid = uid || 193351
            var packet = JSON.stringify({
                uid: uid,
                roomid: rid
            })
            return generatePacket(7, packet)
        },
        init: function(roomid) {
            var self = this
            self.roomid = roomid
            var socket = new WebSocket(wsUrl)
            socket.binaryType = 'arraybuffer'
            socket.onopen = function(event) {
            	if(socket.readyState == 1){
            		console.log("%c 连接弹幕服务器成功", "color: blue");
            	} else {
            		console.log("%c 连接失败了，错误码：" + readyState, "color: red");
            	}
            	
                var join = self.joinRoom(roomid)
                socket.send(join.buffer)
                self.sendBeat(socket)
            }

            socket.onmessage = function(event) {
                var dataView = new DataView(event.data)
//              console.log(event.data);
                var data = {}
                data.packetLen = dataView.getUint32(0)
                dataStruct.forEach(function(item) {
                    if (item.bytes === 4) {
                        data[item.key] = dataView.getUint32(item.offset)
                    } else if (item.bytes === 2) {
                        data[item.key] = dataView.getUint16(item.offset)
                    }
                })
                if (data.op && data.op === 5) {
                    data.body = []
                    var packetLen = data.packetLen;
                    for (var offset = 0; offset < dataView.byteLength; offset += packetLen) {
                        packetLen = dataView.getUint32(offset)
                        headerLen = dataView.getUint16(offset + 4)
//                      console.log(dataView.byteLength,offset,packetLen,headerLen);

                        var recData = []
                        for (var i = offset + headerLen; i < offset + packetLen; i++) {
                            recData.push(dataView.getUint8(i))
                        }
//                      console.log(recData);
                        try {
//                          console.log(bytes2str(recData))
                            let body = JSON.parse(bytes2str(recData));
                              console.log(body); // 弹幕、礼物、系统公告
                            if (body.cmd === 'DANMU_MSG') {
//                              console.log(body.info[2][1], ':', body.info[1]) // 用户：弹幕内容
                                self.fn.call(null, {
                                	uid: body.info[2][0],
                                    name: body.info[2][1],
                                    text: body.info[1],
                                    metal_name: body.info[3][1] || "没勋章",
                                    metal_level: body.info[3][0] || "0",
                                })
                            }
                            data.body.push(body)
//                          console.log(data.body);
                        } catch (e) {
                            // console.log('tcp 校验失败，重新发送')
                        }
                    }
                }
            }

            socket.onclose = function() {
                if (this.roomid) {
					biWebSock.disconnect();
                    console.log('%c 弹幕服务器关闭，1分钟后尝试重连', "color: red");
                }
            }

            self.socket = socket
        },

        then: function(fn) {
            this.fn = fn
        }
    }

    return {
        room: null,
        start: function(roomid) {
        	$('.danmaku_info').empty();
        	$('.danmaku_info').eq(0).prepend('<div style="color: green">获取弹幕中……</div>');
            console.log('%c 正在进入房间：' + roomid + '...', "color: blue")
            this.room = new Room()
            this.room.init(roomid)
            return this.room
        },
        disconnect: function() {
        	$('.danmaku_info').empty();
        	$('.danmaku_info').eq(0).prepend('<div style="color: indianred">弹幕获取停止……</div>');
            if (this.room) {
                console.log('%c 正在退出房间：' + this.room.roomid + '...', "color: red")
                this.room.destroy()
                this.room = null
            }  
        }
    }
})()
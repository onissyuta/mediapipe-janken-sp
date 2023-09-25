document.addEventListener("DOMContentLoaded", main, false);

let playerHand;
let isPlaying = false;
let tick = 0;

const playerCanvas = document.getElementById("player-canvas");
const playerCtx = playerCanvas.getContext("2d");

const cpuCanvas = document.getElementById("cpu-canvas");
const cpuCtx = cpuCanvas.getContext("2d");

const meter = document.getElementById("meter");
const divResult = document.getElementById("result");


const audio = [
    [loadAudio("src/audio/janken.wav"), loadAudio("src/audio/pon.wav")],
    [loadAudio("src/audio/aikode.wav"), loadAudio("src/audio/sho.wav")]
]

const images = [
    loadImage("src/img/hand/0.png"),
    loadImage("src/img/hand/1.png"),
    loadImage("src/img/hand/2.png"),
];



async function main() {
    // handsの初期化
    const hands = new Hands({
        locateFile: file => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
    });
    hands.setOptions({
        selfieMode: true,
        maxNumHands: 1,
        modelComplexity: 1,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5
    });
    hands.onResults(recvResults);


    const video = document.getElementById('video');
    const dialog = document.getElementById('dialog');
    const select = document.getElementById('camera-devices');

    dialog.showModal();


    // カメラの一覧を取得
    await navigator.mediaDevices.getUserMedia({ video: true, audio: false }) // 権限要求のため一瞬カメラをオンにする
        .then(stream => {
            // カメラ停止
            stream.getTracks().forEach(track => {
                track.stop();
            })

            // 入出力デバイスの取得
            navigator.mediaDevices.enumerateDevices().then(mediaDevices => {
                console.log(mediaDevices);
                let count = 1;
                mediaDevices.forEach(mediaDevice => {
                    if (mediaDevice.kind === 'videoinput') {
                        const option = document.createElement('option');
                        option.value = mediaDevice.deviceId;
                        const textNode = document.createTextNode(mediaDevice.label || `Camera ${count++}`);
                        option.appendChild(textNode);
                        select.appendChild(option);
                    }
                });
            });
        })
        .catch(error => alert("エラーが発生しました:\n・カメラアクセスが許可されていません\n・他のアプリでカメラが使用されています"));


    // カメラの起動
    document.getElementById('startBtn').addEventListener('click', async () => {
        dialog.close();
        console.log(select.value)

        await navigator.mediaDevices.getUserMedia({
            video: {
                deviceId: select.value,
                width: 768,
                height: 576
            },
            audio: false,
        })
            .then(
                stream => {
                    video.srcObject = stream;
                    video.play();
                },
                error => {
                    alert("エラーが発生しました:\n他のアプリでカメラが使用されています");
                    console.log(error);
                }
            )
            .then(() => {
                sendHandsImage();
            })
    });


    const sendHandsImage = async () => {
        await hands.send({ image: video })
        requestAnimationFrame(sendHandsImage);
    }


}


function recvResults(results) {
    playerCtx.clearRect(0, 0, playerCanvas.width, playerCanvas.height);
    playerCtx.drawImage(results.image, 0, 0, playerCanvas.width, playerCanvas.height);

    playerCtx.rect(0, 0, playerCanvas.width, 48);
    playerCtx.fillStyle = "rgba(0, 0, 0, .5)";
    playerCtx.fill();

    playerCtx.font = "16px sans-serif";
    playerCtx.fillStyle = "White";
    playerCtx.fillText("現在の手:", 24, 30);
    playerCtx.fillText("関節の角度の合計:", playerCanvas.width - 200, 30);


    playerHand = null;

    if (results.multiHandLandmarks) {
        results.multiHandLandmarks.forEach(marks => {
            drawConnectors(playerCtx, marks, HAND_CONNECTIONS, { color: "#fff", lineWidth: 5 });
            drawLandmarks(playerCtx, marks, { color: "#ff79c6", lineWidth: 5 });

            const calc = getTotalJointDeg(marks);
            playerHand = detectPosture(calc);

            playerCtx.fillText(playerHand.name, 102, 30);
            playerCtx.fillText(Math.floor(calc), playerCanvas.width - 60, 30);
        })
    }

    if (playerHand != null && isPlaying == false && playerHand.id == 0) {
        tick++;
    } else {
        tick = 0;
    }

    if (tick > 75) {
        tick = 0;
        playJanken(1);
    }

    meter.value = tick;
}

function getTotalJointDeg(marks) {
    return vecDeg(vec(marks[1], marks[0]), vec(marks[1], marks[2]))
        + vecDeg(vec(marks[2], marks[1]), vec(marks[2], marks[3]))
        + vecDeg(vec(marks[3], marks[2]), vec(marks[3], marks[4]))
        + vecDeg(vec(marks[5], marks[0]), vec(marks[5], marks[6]))
        + vecDeg(vec(marks[6], marks[5]), vec(marks[6], marks[7]))
        + vecDeg(vec(marks[7], marks[6]), vec(marks[7], marks[8]))
        + vecDeg(vec(marks[9], marks[0]), vec(marks[9], marks[10]))
        + vecDeg(vec(marks[10], marks[9]), vec(marks[10], marks[11]))
        + vecDeg(vec(marks[11], marks[10]), vec(marks[11], marks[12]))
        + vecDeg(vec(marks[13], marks[0]), vec(marks[13], marks[14]))
        + vecDeg(vec(marks[14], marks[13]), vec(marks[14], marks[15]))
        + vecDeg(vec(marks[15], marks[14]), vec(marks[15], marks[16]))
        + vecDeg(vec(marks[17], marks[0]), vec(marks[17], marks[18]))
        + vecDeg(vec(marks[18], marks[17]), vec(marks[18], marks[19]))
        + vecDeg(vec(marks[19], marks[18]), vec(marks[19], marks[20]));
}


function detectPosture(value) {
    if (800 <= value) {
        return new Hand(0);
    } else if (300 <= value && value < 800) {
        return new Hand(1);
    } else {
        return new Hand(2);
    }
}

// ベクトルをオブジェクトで表現
// 座標からベクトルの成分と大きさを計算（A点を始点）
function vec(A, B) {
    return {
        x: B.x - A.x, // (終点) - (始点)
        y: B.y - A.y,
        z: B.z - A.z,
        length: Math.sqrt(Math.pow(B.x - A.x, 2) + Math.pow(B.y - A.y, 2) + Math.pow(B.z - A.z, 2)) // ベクトルの2乗は大きさの2乗
    };
}

// 2ベクトルのなす角を計算
function vecDeg(A, B) {
    // ベクトルの内積
    const innerProd = A.x * B.x + A.y * B.y + A.z * B.z;

    // 2ベクトルがなす角のcos
    const cos = innerProd / (A.length * B.length);

    // acosを度数法で返す
    return 180 - (Math.acos(cos) / (Math.PI / 180)); // 180度からの角度
}


// handAがhandBに (返り値) 0:引き分け 1:負け 2:勝ち
function judgeJanken(handA, handB) {
    if (handA == null) return 1;

    if (handA.id === handB.id) {
        return 0;
    } else if (handA.id === 0) {
        if (handB.id === 1) {
            return 2;
        } else if (handB.id === 2) {
            return 1;
        }
    } else if (handA.id === 1) {
        if (handB.id === 0) {
            return 1;
        } else if (handB.id === 2) {
            return 2;
        }
    } else if (handA.id === 2) {
        if (handB.id === 0) {
            return 2;
        } else if (handB.id === 1) {
            return 1;
        }
    }
}


function Hand(id) {
    this.id = id;
    this.hands = ["グー", "チョキ", "パー"];
    this.name = this.hands[id];
}


async function playJanken(num) {
    if (!isPlaying) { // 多重起動防止
        isPlaying = true;

        let result = 1;
        for (let i = 0; i < num; i++) {
            do {
                result = await fetchJankenGame(result);
            } while (!result); // あいこじゃ なくなるまで
        }

        isPlaying = false;
    }
}


function fetchJankenGame(result) { // result: falseであいこモード
    return new Promise(resolve => {
        divResult.textContent = "";
        divResult.dataset.result = "";

        audio[result ? 0 : 1][0].currentTime = 0;
        audio[result ? 0 : 1][0].play();

        // ルーレット
        let count = 0;
        const id = setInterval(() => {
            cpuCtx.clearRect(0, 0, cpuCanvas.width, cpuCanvas.height);
            cpuCtx.drawImage(images[count], 0, 0, 1000, 1000, 0, 0, cpuCanvas.width, cpuCanvas.height);
            if (++count > 2) count = 0;
        }, 100);

        audio[result ? 0 : 1][0].addEventListener('ended', () => {
            resolve(id);
        });
    })
        .then(id => {
            return new Promise(resolve => {
                audio[result ? 0 : 1][1].currentTime = 0;
                audio[result ? 0 : 1][1].play();

                // 手を出す時間を考慮してちょっと待つ
                setTimeout(() => resolve(id), 400);
            })
        })
        .then(id => {
            return new Promise(resolve => {
                // ルーレット止める
                clearInterval(id);

                // CPUの手を決定
                const cpuHand = new Hand(Math.floor(Math.random() * 3));

                // cpuCanvasにCPUの手を描画
                cpuCtx.clearRect(0, 0, cpuCanvas.width, cpuCanvas.height);
                cpuCtx.drawImage(images[cpuHand.id], 0, 0, 1000, 1000, 0, 0, cpuCanvas.width, cpuCanvas.height);

                // じゃんけんの勝敗を判定
                const result = judgeJanken(playerHand, cpuHand);

                // 勝敗を描画
                const resultName = ["引き分け", "負け", "勝ち"];
                divResult.dataset.result = result;
                divResult.textContent = resultName[result];

                // 1秒待って終了
                setTimeout(() => resolve(result), 1000);
            })
        });
}


function loadImage(src) {
    const imageIns = new Image();
    imageIns.src = src;
    return imageIns;
}


function loadAudio(src) {
    const audioIns = new Audio();
    audioIns.src = src;
    audioIns.load();
    return audioIns;
}
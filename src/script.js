import {
    HandLandmarker,
    FilesetResolver
  } from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0";



let playerHand;
let isPlaying = false;


const divResult = document.getElementById("result");

const video = document.getElementById("video");
const canvasElement = document.getElementById("player-canvas"); 
const canvasCtx = canvasElement.getContext("2d");

const divCurrentHand = document.getElementById("currentHand");

const divHands = document.getElementById("hands");

const body = document.querySelector("body");


const dialog = document.getElementById('dialog');
const select = document.getElementById('camera-devices');


const AudioContext = window.AudioContext || window.webkitAudioContext;

const audioContext = new AudioContext();

// get the audio element
const audioElements = document.querySelectorAll("audio");

// pass it into the audio context

audioElements.forEach(elm => {
    const track = audioContext.createMediaElementSource(elm);
    track.connect(audioContext.destination);
});


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
                deviceId: select.value
            },
            audio: false,
        })
        .then(
            stream => {
                video.srcObject = stream;
                video.play();
                video.addEventListener("loadeddata", renderLoop);
            },
            error => {
                alert("エラーが発生しました:\n他のアプリでカメラが使用されています");
                console.log(error);
            }
        )
    });



const vision = await FilesetResolver.forVisionTasks(
    // path/to/wasm/root
    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
);

const handLandmarker = await HandLandmarker.createFromOptions(
    vision,
    {
    baseOptions: {
        modelAssetPath: "./app/shared/models/hand_landmarker.task",
        delegate: "GPU",
    },
    numHands: 1
});




await handLandmarker.setOptions({ runningMode: "video" });
let lastVideoTime = -1;
let results = undefined;

async function renderLoop() {
    canvasElement.width = video.videoWidth;
    canvasElement.height = video.videoHeight;

    let startTimeMs = performance.now();
    if (video.currentTime !== lastVideoTime) {
        lastVideoTime = video.currentTime;
        results = handLandmarker.detectForVideo(video,startTimeMs);
    }

    canvasCtx.save();
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
    // canvasCtx.drawImage(video, 0, 0, canvasElement.width, canvasElement.height);


    playerHand = null;

    if (results.landmarks) {
      for (const landmarks of results.landmarks) {
        drawConnectors(canvasCtx, landmarks, HAND_CONNECTIONS, {
          color: "#00FF00",
          lineWidth: 5
        });
        drawLandmarks(canvasCtx, landmarks, { color: "#FF0000", lineWidth: 2 });

        const calc = getTotalJointDeg(landmarks);
        playerHand = detectPosture(calc);

        divCurrentHand.textContent = playerHand.name;

      }
    }
    canvasCtx.restore();

    requestAnimationFrame(renderLoop);
}



document.querySelector(".frame").addEventListener("click", () => playJanken(1));

document.addEventListener("keydown", event => {
    if (event.code === "Space") {
        playJanken(1);
    }
});


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
    if (isPlaying) { // 多重起動防止
        return
    }

    isPlaying = true;

    let result = 1;
    for (let i = 0; i < num; i++) {
        do {
            result = await fetchJankenGame(result);
        } while (!result); // あいこじゃ なくなるまで
    }

    isPlaying = false;
}



function fetchJankenGame(result) { // result: falseであいこモード
    return new Promise(resolve => {
        divResult.textContent = "";
        divResult.dataset.result = "";

        // check if context is in suspended state (autoplay policy)
        if (audioContext.state === "suspended") {
            audioContext.resume();
        }

        audioElements[result ? 0 : 2].play();

        // CPUの手のルーレットを描画
        divHands.style.top = "-360px";


        audioElements[result ? 0 : 2].addEventListener('ended', () => {
            resolve();
        });
    })
        .then(() => {
            return new Promise(resolve => {
     
                audioElements[result ? 1 : 3].play();


                // 手を出す時間を考慮してちょっと待つ
                setTimeout(() => resolve(), 400);
            })
        })
        .then(() => {
            return new Promise(resolve => {
     
                // CPUの手を決定
                const cpuHand = new Hand(Math.floor(Math.random() * 3));

                // CPUの手を描画
                divHands.style.top = -120 * cpuHand.id + "px";

                // じゃんけんの勝敗を判定
                const result = judgeJanken(playerHand, cpuHand);

                
                // 勝敗を描画
                const resultName = ["引き分け", "負け", "勝ち"];
                body.dataset.result = result;

                divResult.textContent = resultName[result];

                // 1秒待って終了
                setTimeout(() => {
                    divResult.textContent = null;
                    body.dataset.result = null;

                    resolve(result)
                }, 1500);
            })
        });
}
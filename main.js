let APP_ID = "58491d58f8044b5789c043f8385c6a57";

let token = null;
let uid = String(Math.floor(Math.random() * 10000));

let client;
let channel;
let localStream;
let remoteStream;
let peerConnection;

const servers = {
    iceServers:[
        {
            urls:['stun:stun1.l.google.com:19302','stun:stun2.l.google.com:19302']
        }
    ]
}

const mediaAccess = {
    video: true,
    audio: true
}

let init = async () => {
    client = await AgoraRTM.createInstance(APP_ID);
    await client.login({uid,token});

    // in url => /index.html?room=12323
    channel = client.createChannel('main')
    await channel.join()

    // Listening for other users to connect to the same channel
    channel.on('MemberJoined', handleUserJoined);

    // Listening for other user message
    client.on('MessageFromPeer',handleMessageFromPeer);

    // Managing  localStream
    localStream = await navigator.mediaDevices.getUserMedia(mediaAccess);
    loclaLocalStream = await navigator.mediaDevices.getUserMedia({video:true, audio:false});
    document.getElementById("user-1").srcObject = loclaLocalStream;
}

// Callback function for client.on => MemberJoined event
let handleMessageFromPeer = async (message, MemberId) =>
{

    message = JSON.parse(message.text);
    console.log('Message from peer:', message);

    if(message.type === 'offer'){
        await createAnswer(MemberId,message.offer);
    }

    if(message.type === 'answer'){
        await addAnswer(message.answer);
    }

    if(message.type === 'candidate'){
        if(peerConnection){
            await peerConnection.addIceCandidate(message.candidate);
        }
    }
}

// Callback function for channel.on => MessageFromPeer event
let handleUserJoined = async (MemberId)=>
{
    console.log('A new user joined the channel:', MemberId);

    // It creates an offer and some ice candidates when another user joined
    await createOffer(MemberId);
}

let createPeerConnection = async (MemberId)=>{
    peerConnection = new RTCPeerConnection(servers);

    remoteStream = new MediaStream();
    document.getElementById("user-2").srcObject = remoteStream;

    if(!localStream){
        localStream = await navigator.mediaDevices.getUserMedia(mediaAccess);
        document.getElementById("user-1").srcObject = localStream;
    }


    // Passing Tracks to the peerConnection
    localStream.getTracks().forEach((track)=>
    {
        peerConnection.addTrack(track,localStream)
        //console.log(peerConnection)
    });

    // Event Management (listening for when peer adds their track too)
    peerConnection.ontrack = (event) =>
    {
        event.streams[0].getTracks().forEach((track)=> {
            remoteStream.addTrack(track);
        })
    }

    // Sends requests to stun servers and creates some ice candidates
    peerConnection.onicecandidate = async (event) =>
    {
        if(event.candidate){
            console.log('New Ice candidate:', event.candidate);
            client.sendMessageToPeer({text: JSON.stringify({'type':'candidate','candidate':event.candidate})},MemberId);
        }
    }
}

// Creating Offers and Ice Candidates
let createOffer = async (MemberId)=>
{
    await createPeerConnection(MemberId);

    let offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer); // setting local description will trigger icecandidate
    console.log('offer:',offer);

    // Once the offer created send a message and the created offer to the Peer user
    client.sendMessageToPeer({text: JSON.stringify({'type':'offer','offer':offer})},MemberId);
}

let createAnswer = async (MemberId, offer) =>{
    await createPeerConnection(MemberId);

    await peerConnection.setRemoteDescription(offer);

    let answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);

    client.sendMessageToPeer({text: JSON.stringify({'type':'answer','answer':answer})},MemberId);

}

let addAnswer = async (answer) =>{
    if(!peerConnection.currentRemoteDescription){
        await peerConnection.setRemoteDescription(answer);
    }
}

init();

import React from 'react'
import { StyleSheet, View, Text, Button, Pressable, Image, TouchableOpacity, ScrollView, TextInput } from 'react-native'
import { Audio } from 'expo-av';

import {useState, useRef} from "react";
import * as FileSystem from 'expo-file-system';
import AudioRecord from './AudioRecord';

// import firebase from 'firebase/compat/app'

import * as firebase from 'firebase/compat'
import 'firebase/storage'
import { db, auth } from '../firebase-config';
import { storage } from '../firebase-config';

import { getStorage, ref, getDownloadURL, uploadBytes } from "firebase/storage";

// import axios from 'axios';

// import Microphone from '../assets/images/microphone.svg';


export default function AudioRecorder(){

    // la configuration de ma cloud function appel l'api avec le format pour IOS ! Attention verifier si le format android amrche aussi
    const recordingSettings = {
        android: {
          extension: ".m4a",
          outputFormat: Audio.RECORDING_OPTION_ANDROID_OUTPUT_FORMAT_MPEG_4,
          audioEncoder: Audio.RECORDING_OPTION_ANDROID_AUDIO_ENCODER_AMR_WB,
          sampleRate: 44100,
          numberOfChannels: 2,
          bitRate: 128000,
        },
        ios: {
          extension: ".m4a",
          outputFormat: Audio.RECORDING_OPTION_IOS_OUTPUT_FORMAT_LINEARPCM,
          audioQuality: Audio.RECORDING_OPTION_IOS_AUDIO_QUALITY_MIN,
          sampleRate: 44100,
          numberOfChannels: 2,
          bitRate: 128000,
          linearPCMBitDepth: 16,
          linearPCMIsBigEndian: false,
          linearPCMIsFloat: false,
        },
      };
      
      
      
      const [transcript, setTranscript] = useState('Mon reve')
      const [RecordedURI, SetRecordedURI] = useState('');
      const [isRecording, setIsRecording] = useState(false);
      const [recording, setRecording] = useState(null);
      const [sound, setSound] = useState(null);
      const [isPlaying, setIsPlaying] = useState(false);
      const [finalDuration, setFinalDuration] = useState("0.0 ")
      const [duration, setDuration] = useState("0.0 ")
      const [timer, setTimer] = useState(0)
      const Player = useRef(new Audio.Sound());


      let start_time = Date.now()
      let end_time = Date.now()
      
      function findDuration(){
          return setDuration(((Date.now() - start_time)/1000).toString().substring(0,2))
      }

    // Start Recording
    const startRecording = async () => {

        let start_time = Date.now() 
        setTimer(0)

        // stop playback
        if (sound !== null) {
          await sound.unloadAsync();
          sound.setOnPlaybackStatusUpdate(null);
          setSound(null);
        }
    
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: true,
          interruptionModeIOS: Audio.INTERRUPTION_MODE_IOS_DO_NOT_MIX,
          playsInSilentModeIOS: true,
          shouldDuckAndroid: true,
          interruptionModeAndroid: Audio.INTERRUPTION_MODE_ANDROID_DO_NOT_MIX,
          playThroughEarpieceAndroid: false,
          staysActiveInBackground: true,
        });
        let _recording = new Audio.Recording();

        try {
          await _recording.prepareToRecordAsync(recordingSettings);
          setRecording(_recording);
          await _recording.startAsync();
          console.log("recording");
        
        } catch (error) {
            console.log("error while recording:", error);
        }

        let timer = setInterval(findDuration, 1000)
        setTimer(timer)
		setIsRecording(true)
        
      };

// Stop recording

      const stopRecording = async () => {
        let end_time = Date.now()
        let finalDuration = (end_time - start_time)/1000
        setFinalDuration(finalDuration)
        console.log(finalDuration)

        clearInterval(timer)
        setTimer(timer)
        

        try {
          await recording.stopAndUnloadAsync();
        //   await recording._cleanupForUnloadedRecorder();
        } catch (error) {
          // Do nothing -- we are already unloaded.
        }
        let result = recording.getURI();
        
        SetRecordedURI(result); 

        const info = await FileSystem.getInfoAsync(result);
        // console.log(`FILE INFO: ${JSON.stringify(info)}`);
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: false,
          interruptionModeIOS: Audio.INTERRUPTION_MODE_IOS_DO_NOT_MIX,
          playsInSilentModeIOS: true,
          playsInSilentLockedModeIOS: true,
          shouldDuckAndroid: true,
          interruptionModeAndroid: Audio.INTERRUPTION_MODE_ANDROID_DO_NOT_MIX,
          playThroughEarpieceAndroid: false,
          staysActiveInBackground: true,
        });
        const { sound: _sound, status } = await recording.createNewLoadedSoundAsync(
          {
            isLooping: true,
            isMuted: false,
            volume: 1.0,
            rate: 1.0,
            shouldCorrectPitch: true,
          }
        );
        setSound(_sound);
        setIsRecording(false);
        // console.log(isRecording)
      };

      const playSound = async () => {
        try {
          const result = await Player.current.loadAsync(
            { uri: RecordedURI },
            {},
            true
          );
    
          const response = await Player.current.getStatusAsync();
          if (response.isLoaded) {
            if (response.isPlaying === false) {
              Player.current.playAsync();
              console.log('hmmm')
              SetisPlaying(true);
              console.log("mais je joue la !!! ")
            }
          }
        } catch (error) {
            console.log("c'est la ")
          console.log(error);
        }
      };

      const stopSound = async () => {
        try {
            const checkLoading = await Player.current.getStatusAsync();
            if (checkLoading.isLoaded === true) {
            await Player.current.stopAsync();
            SetisPLaying(false);
            }
        } catch (error) {
            console.log(error);
        }
        };

    //   Upload Audio 

    const uploadAudio = async () => {
    const uri = recording.getURI();
    try {
        const blob = await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.onload = () => {
            try {
            resolve(xhr.response);
            } catch (error) {
            console.log("error:", error);
            }
        };
        xhr.onerror = (e) => {
            console.log(e);
            reject(new TypeError("Network request failed"));
        };
        xhr.responseType = "blob";
        xhr.open("GET", uri, true);
        xhr.send(null);
        });
        if (blob != null) {
        const uriParts = uri.split(".");
        const fileType = uriParts[uriParts.length - 1];
        const date = new Date()
        const uid = auth.currentUser.uid
        
        const date_for_name = date.toLocaleString('en-US', { 
          day: "2-digit",
          year: 'numeric', // numeric, 2-digit
          month: '2-digit', // numeric, 2-digit, long, short, narrow
          hour: '2-digit', // numeric, 2-digit
          minute: '2-digit',
      
      }).replaceAll("/", "-").replace(", ", "-").substring(0,16)
        const fileName = date_for_name + uid

        // ------------------V9-------------------

        const storageRef = ref(storage, `${fileName}.${fileType}`)
        const metadata = {
          contentType: `audio/${fileType}`,
        };

        uploadBytes(storageRef, blob, metadata).then((snapshot) => {
          console.log('Audio has been sent to storage');
        });


        } else {
        console.log("erroor with blob");
        }
    } catch (error) {
        console.log("error:", error);
    }
    };

//
// Download audio
//
    const downloadAudio = async () => {
        const uri = await firebase
          .storage()
          .ref("nameOfTheFile.filetype")
          .getDownloadURL();
    
        console.log("uri:", uri);
    
        // The rest of this plays the audio
        const soundObject = new Audio.Sound();
        try {
          await soundObject.loadAsync({ uri });
          await soundObject.playAsync();
        } catch (error) {
          console.log("error:", error);
        }
      };


// 
// Download Transcript
//

      const downloadTranscript = async () =>{

    
        firebase
        .storage()
        .ref('transcripts/nameOfThe0.38379679470797035.m4a-20211112053155.json')
        .getDownloadURL().then((url) =>{
                // console.log(url)
                const xhr = new XMLHttpRequest();
                xhr.responseType = 'json';
                xhr.open('GET', url);
                xhr.send();
               
                xhr.onload = function() {
                    let response = xhr.response
                    let text_transcript = response.results[0].alternatives[0].transcript
                    
                    setTranscript(text_transcript)
                    // sleep(2000)
                  };
                
                
            })
            
      }

    return(
        <View>
            <View style= {styles.container}>
               
               <Text style= {styles.text_time}> Maintenir pour enregistrer</Text>
                
                {/* <TouchableOpacity 
                    style = {styles.playSound}
                    onPress={playSound}
                    // onPress={console.log(transcript)}
                >
                    
                    <Text style= {styles.text_time}>
                        Réecouter mon rêve ! 
                    </Text>
                     */}
                    {/* Reutilisable pour un component dream recap */}
                    {/* <View style= {styles.button_play_view}>
                        
                        <Text style= {styles.text_time}>
                            {duration} s
                        </Text>
                        <View
                            style={styles.button_play}>
                            <View style={[styles.triangle,styles.arrowRight]}></View>
                        </View>
                    </View> */}

                {/* </TouchableOpacity> */}


                {/* <TouchableOpacity 
                    style = {styles.playSound}
                    onPress={stopSound}
                >
                    <Text style= {styles.text_time}>
                        Stopper l'écoute 
                    </Text>
                </TouchableOpacity> */}

            </View>
                
            <View  style= {styles.container_recorder}>
                
                <Pressable 
                    style={styles.button_recorder}
                    hitSlop = {{top: 0, bottom: 50, left: 50, right: 50}}
                    onLongPress= {startRecording}
                    onPressOut= { () => { if (isRecording){
                                            console.log("stop recording")
											stopRecording() ;
                                            uploadAudio()
					}
                                        else{
                                            alert("maintenir pour enregistrer")
                                        }
                                        }
                                }
                >

                    <View style={styles.microphone}>
                        <Image source = {require('../assets/images/microphone.png')}
                                style = {styles.icon_mic}
                        >
                        </Image>
                        
                    </View>
                </Pressable>
                <Text style= {styles.text_time}>
                    {duration} secondes
                </Text>
            </View>
        </View>
        
    )
}
const styles = StyleSheet.create({

    container:{
        justifyContent:'center', 
        alignItems:'center',
    },
    container_recorder:{
        justifyContent:'center', 
        alignItems:'center',
    },
    playSound:{
        marginTop:30,
        width:300, 
        height:50,
        borderRadius:30,
        backgroundColor:'#2E206F', 
        justifyContent:'center',
        alignItems:'center'
    },
   
    text_time:{
        fontFamily:'Harmattan-Bold', 
        fontSize:25,
        color:'white'
    },
    button_recorder: {
        backgroundColor:'#2E206F', 
        width:120, 
        height:120, 
        borderRadius:60, 
        justifyContent:'center', 
        alignItems:'center', 
        marginTop:30
        // textAlign:'center'
    }, 
    text_recorder:{
        fontFamily:"Harmattan-Regular", 
        color:"white", 
        fontSize:15
    }, 
    microphone:{
        width:90, 
        height:90, 
        borderRadius:45,
        justifyContent:'center', 
        alignItems:'center',
        backgroundColor:'#8044CD',
    }, 
    icon_mic:{
        width:40, 
        height:40
    },

    button_play_view:{
        flex:1.5,
        flexDirection:'row',
        // justifyContent:'center',
        alignItems:'center',
        
        paddingRight:20,
        paddingLeft:20
    },
    button_play: {
        height:40,
        width:40,
        borderRadius: 180, 
        position:'absolute',
        right:30,
        backgroundColor:'#0F143A',
        justifyContent:'center',
        alignItems:'center'
        // marginRight:10
    },
    triangle: {
        width: 0,
        height: 0,
        backgroundColor: 'transparent',
        borderStyle: 'solid',
    },
    arrowRight: {
        borderTopWidth: 8,
        borderRightWidth: 0,
        borderBottomWidth: 8,
        borderLeftWidth: 12,
        borderTopColor: 'transparent',
        borderRightColor: 'transparent',
        borderBottomColor: 'transparent',
        borderLeftColor: "white",
        borderRadius:5
    },
})
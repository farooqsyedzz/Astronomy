const { EdgeTTS } = require('node-edge-tts');

async function test() {
  const tts = new EdgeTTS({
    voice: 'en-US-GuyNeural',
    lang: 'en-US',
    rate: '+15%',
    outputFormat: 'audio-24khz-48kbitrate-mono-mp3'
  });
  
  await tts.ttsPromise('Hello world! This is a test of a much more dynamic and energetic voice for our video generator.', './test_audio.mp3');
  console.log('Audio generated: test_audio.mp3');
}
test();

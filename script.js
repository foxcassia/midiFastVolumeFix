const {parseMidi, writeMidi} = require('midi-file');  
const VELOCITY_LIMIT = 127;

let processedData = undefined;
let processedDataFileName = '';
let fileType = 'audio/midi';

function downloadFile(data, filename, type) {
    console.log('Downloading ', filename)
    var file = new Blob([data], {type: type});
    var a = document.createElement("a");
    var url = URL.createObjectURL(file);
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(function() {
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);  
    }, 0);
}

function changeVelocityInMidi(midiTracksArray, percentIncrease){
    for(const track of midiTracksArray){
        for(const note of track){
            if(!note.velocity){
                 continue;
            }
            let newVelocity = Math.floor(Math.min(percentIncrease * note.velocity, VELOCITY_LIMIT));
            if(newVelocity < 0){
                newVelocity = 0;
            }
            console.log(`Starting velocity: ${note.velocity}\nNew velocity: ${newVelocity}`);
            note.velocity = newVelocity;
        }
    }
}

function normalizeMidi(midiTracksArray, newMin, newMax){
    for(const track of midiTracksArray){
        const trackNotes = track.map(n => n.velocity).filter(v => v && v !== 0);
        const min = Math.min(...trackNotes);
        const max = Math.max(...trackNotes);

        for(const note of track){
            note.velocity = ((note.velocity - min) / (max - min)) * (newMax - newMin) + newMin;
        }
    }

}

document.getElementById("downloadButtonVelocityPercent").onclick = function() {
    downloadFile(processedData, processedDataFileName, fileType);
};
document.getElementById("downloadButtonNormalizeMidi").onclick = function() {
    downloadFile(processedData, processedDataFileName, fileType);
};
document.getElementById("scaleVelocityPercent").oninput = function() {
    document.getElementById("scaleVelocityPercentValue").innerHTML = this.value + '%';
}
document.getElementById("scaleNormalizeMidiMaximum").oninput = function() {
    document.getElementById("scaleNormalizeMidiMaximumValue").innerHTML = this.value;
}
document.getElementById("scaleNormalizeMidiMinimum").oninput = function() {
    document.getElementById("scaleNormalizeMidiMinimumValue").innerHTML = this.value;
}

document.getElementById("processButtonNormalizeMidi").onclick = function() {
    const minVol = parseInt(document.getElementById("scaleNormalizeMidiMinimum").value);
    const maxVol = parseInt(document.getElementById("scaleNormalizeMidiMaximum").value);
    const file = document.getElementById("fileUpload").files[0];

    if(minVol > maxVol){
        console.log('Nope');
        return;
    }

    if (!file) {
        console.log("No file");
        return;
    }

    console.log("File uploaded:", file.name);
    processedDataFileName = `Edit ${file.name}`;

    if (file.size === 0) {
        console.error("Bad file?");
        return;
    }

    const reader = new FileReader();

    reader.onload = function(event) {
        const arrayBuffer = event.target.result;
        const uint8Array = new Uint8Array(arrayBuffer);
        try {
            const parsedMidi = parseMidi(uint8Array);
            normalizeMidi(parsedMidi.tracks, minVol, maxVol);
            processedData = Buffer.from(writeMidi(parsedMidi));
            document.getElementById("downloadButtonNormalizeMidi").style.display = 'block';
        } catch (error) {
            console.error("Error:", error);
        }
    };
    
    reader.onerror = function(event) {
        console.error("FileReader error:", event.target.error);
    };

    reader.readAsArrayBuffer(file);
};

document.getElementById("processButtonVelocityPercent").onclick = function() {
    const selectedIncrease = parseInt(document.getElementById("scaleVelocityPercent").value);
    const percentIncrease = selectedIncrease/100
    const file = document.getElementById("fileUpload").files[0];    
    console.log(`Increasing by ${selectedIncrease}%`);

    if(percentIncrease === 100){
        console.log('Why bother?');
        return;
    }

    if (!file) {
        console.log("No file");
        return;
    }

    console.log("File uploaded:", file.name);
    processedDataFileName = `Edit ${file.name}`;

    if (file.size === 0) {
        console.error("Bad file?");
        return;
    }

    const reader = new FileReader();

    reader.onload = function(event) {
        const arrayBuffer = event.target.result;
        const uint8Array = new Uint8Array(arrayBuffer);
        try {
            const parsedMidi = parseMidi(uint8Array);
            console.log("Parsed MIDI data:", parsedMidi);
            changeVelocityInMidi(parsedMidi.tracks, percentIncrease);
            processedData = Buffer.from(writeMidi(parsedMidi));
            document.getElementById("downloadButtonVelocityPercent").style.display = 'block';
        } catch (error) {
            console.error("Error:", error);
        }
    };
    
    reader.onerror = function(event) {
        console.error("FileReader error:", event.target.error);
    };

    reader.readAsArrayBuffer(file);
};
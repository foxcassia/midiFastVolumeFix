const {parseMidi, writeMidi} = require('midi-file');  
const JSZip = require('jszip');

const VELOCITY_LIMIT = 127;

let processedData = undefined;
let processedDataFileName = '';
let fileType = 'audio/midi';
let zipType = 'application/zip';

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

function handleUpload(){
    const file = document.getElementById("fileUpload").files[0];
    console.log("File uploaded: ", file.name);
    console.log("file type: ", file.type);

    if(file.type === 'application/x-zip-compressed' || file.type === 'application/zip'){
        return unzipMidiRepo(file);
    }

    if (!file) {
        console.log("No file");
        return;
    }

    if (file.size === 0) {
        console.error("Bad file?");
        return;
    }

    processedDataFileName = `Edit ${file.name}`;

    return file;
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

function unzipMidiRepo(file){
    return new Promise((resolve, reject) => {
        if (!file) {
            reject(new Error("No file provided"));
            return;
        }

        const reader = new FileReader();
        reader.onload = function(event) {
            const zip = new JSZip();
            zip.loadAsync(event.target.result)
                .then(zip => {
                    const filePromises = Object.keys(zip.files).map(filename => {
                        return zip.files[filename].async('blob').then(blob => {
                            // could put processing here but meh
                            return new File([blob], filename, { type: blob.type });
                        });
                    });

                    return Promise.all(filePromises);
                })
                .then(files => resolve(files))
                .catch(err => reject(err));
        };

        reader.onerror = () => reject(new Error("Error reading file"));

        reader.readAsArrayBuffer(file);
    });
}

async function zipFiles(files) {
    const zip = new JSZip();
    for( let i = 0; i < files.length; i ++) {
        zip.file(files[i][0], files[i][1]);
    }

    return await zip.generateAsync({ type: "nodebuffer" });
}

document.getElementById("downloadButtonVelocityPercent").onclick = function() {
    downloadFile(processedData, processedDataFileName, fileType);
};
document.getElementById("downloadButtonNormalizeMidi").onclick = function() {
    downloadFile(processedData, processedDataFileName, fileType);
};
document.getElementById("downloadButtonNormalizeMidiRepo").onclick = function() {
    zipFiles(processedData).then((r)=>{
        downloadFile(r, processedDataFileName, zipType);
    })
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
document.getElementById("scaleNormalizeMidiMaximumRepo").oninput = function() {
    document.getElementById("scaleNormalizeMidiMaximumValueRepo").innerHTML = this.value;
}
document.getElementById("scaleNormalizeMidiMinimumRepo").oninput = function() {
    document.getElementById("scaleNormalizeMidiMinimumValueRepo").innerHTML = this.value;
}

document.getElementById("processButtonVelocityPercent").onclick = function() {
    const selectedIncrease = parseInt(document.getElementById("scaleVelocityPercent").value);
    const percentIncrease = selectedIncrease/100
    const file = handleUpload();   
    console.log(`Increasing by ${selectedIncrease}%`);

    if(percentIncrease === 100){
        console.log('Why bother?');
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

document.getElementById("processButtonNormalizeMidi").onclick = function() {
    const minVol = parseInt(document.getElementById("scaleNormalizeMidiMinimum").value);
    const maxVol = parseInt(document.getElementById("scaleNormalizeMidiMaximum").value);
    const file = handleUpload();
    
    if(minVol > maxVol){
        console.log('Nope');
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

document.getElementById("processButtonNormalizeMidiRepo").onclick = function() {
    const minVol = parseInt(document.getElementById("scaleNormalizeMidiMinimumRepo").value);
    const maxVol = parseInt(document.getElementById("scaleNormalizeMidiMaximumRepo").value);
    processedDataFileName = 'ProcessedMidis'
    handleUpload().then((files)=>{
        const processedDataArray = [];
    
        if(minVol > maxVol){
            console.log('Nope');
            return;
        }

        for(const file of files){
            const reader = new FileReader();

            reader.onload = function(event) {
                const arrayBuffer = event.target.result;
                const uint8Array = new Uint8Array(arrayBuffer);
                try {
                    const parsedMidi = parseMidi(uint8Array);
                    normalizeMidi(parsedMidi.tracks, minVol, maxVol);
                    const processed = Buffer.from(writeMidi(parsedMidi))
                    processedDataArray.push([file.name, processed]);
                } catch (error) {
                    console.error("Error:", error);
                }
            };
            
            reader.onerror = function(event) {
                console.error("FileReader error:", event.target.error);
            };
            reader.readAsArrayBuffer(file);
        }

        processedData = processedDataArray;
        document.getElementById("downloadButtonNormalizeMidiRepo").style.display = 'block';
    });
};

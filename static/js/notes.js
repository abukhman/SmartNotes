import WaveSurfer from 'https://unpkg.com/wavesurfer.js@7/dist/wavesurfer.esm.js'

// Create the waveform
const wavesurfer = WaveSurfer.create({
    container: '#waveform',
    waveColor: '#4F4A85',
    progressColor: '#383351',
    dragToSeek: true,
})

// Hover effect
{
    const hover = document.querySelector('#hover')
    const waveform = document.querySelector('#waveform')
    waveform.addEventListener('pointermove', (e) => (hover.style.width = `${e.offsetX}px`))
}

// Current time & duration
{
    const formatTime = (seconds) => {
        const minutes = Math.floor(seconds / 60)
        const secondsRemainder = Math.round(seconds) % 60
        const paddedSeconds = `0${secondsRemainder}`.slice(-2)
        return `${minutes}:${paddedSeconds}`
    }

    const timeEl = document.querySelector('#time')
    const durationEl = document.querySelector('#duration')
    wavesurfer.on('decode', (duration) => (durationEl.textContent = formatTime(duration)))
    wavesurfer.on('timeupdate', (currentTime) => (timeEl.textContent = formatTime(currentTime)))
}

$('button#play').on('click', function () {
    wavesurfer.playPause()
});

let openRequest = indexedDB.open('smart_notes', 1)

// init and upgrade
openRequest.onupgradeneeded = function () {
    let db = openRequest.result
    if (!db.objectStoreNames.contains('notes')) {
        db.createObjectStore('notes', { keyPath: 'id' })
    }
};

openRequest.onerror = function () {
    console.error("Error", openRequest.error)
};

$(document).ready(function () {
    openRequest.onsuccess = function () {
        let db = openRequest.result
        let transaction = db.transaction('notes', 'readonly')
        let notes = transaction.objectStore('notes')

        let item = notes.get(note_id)

        // get and set audio, text and notes
        item.onsuccess = function () {
            if (item.result == undefined) {
                console.error('No such note is presented')
                return
            }

            let name = item.result['name']
            let text = item.result['text']
            let notes = item.result['notes']
            let blob = item.result['audio']

            $('#name').val(name)
            $('textarea#text').val(text)
            $('textarea#notes').val(notes)

            fetch(blob)
                .then(res => res.blob())
                .then(blob => {
                    wavesurfer.loadBlob(blob);

                    wavesurfer.on('interaction', () => {
                        wavesurfer.playPause()
                    })
                })
        }

        item.onerror = function () {
            console.error("Error", openRequest.error)
        };
    };
})

$('button#save').on('click', function () {
    var textToSave = document.getElementById("notes").value;
    var textToSaveAsBlob = new Blob([textToSave], { type: "text/plain" });
    var textToSaveAsURL = window.URL.createObjectURL(textToSaveAsBlob);
    var fileNameToSaveAs = "notes"

    var downloadLink = document.createElement("a");
    downloadLink.download = fileNameToSaveAs;
    downloadLink.innerHTML = "Download File";
    downloadLink.href = textToSaveAsURL;
    downloadLink.onclick = destroyClickedElement;
    downloadLink.style.display = "none";
    document.body.appendChild(downloadLink);

    downloadLink.click();
});

function destroyClickedElement(event) {
    document.body.removeChild(event.target);
}

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
        console.log('open db')
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

            console.log(item.result)

            let name = item.result['name']
            let blob = item.result['audio']
            let text = item.result['text']
            let notes = item.result['notes']

            audio_url = URL.createObjectURL(blob)
            console.log(audio_url)

            $('#name').val(name)
            $('audio#audio').src = audio_url
            $('textarea#text').val(text)
            $('textarea#notes').val(notes)
        }

        item.onerror = function () {
            console.error("Error", openRequest.error)
        };
    };
})

function saveTextAsFile() {
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
}

function destroyClickedElement(event) {
    document.body.removeChild(event.target);
}

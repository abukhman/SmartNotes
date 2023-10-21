let AUTH_KEY = 'authorization-data'
// check if there is saved auth data
let auth = localStorage.getItem(AUTH_KEY) || ''

let db_event = new EventTarget()
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
openRequest.onsuccess = function () {
    let db = openRequest.result

    // get text and redirect url
    // should save text before redirect
    db_event.addEventListener('add', function (event) {
        console.log(event)

        add_note(db,
            event.detail['audio'],
            event.detail['text'],
            event.detail['redirect_url'])
    })
};

function add_note(db, audio, text, redirect_url) {
    let note_id = crypto.randomUUID()
    let transaction = db.transaction('notes', 'readwrite')
    let notes = transaction.objectStore('notes')

    let note = {
        id: note_id,
        name: 'Note',
        audio: audio,
        text: text,
        notes: ''
    }

    let request = notes.add(note)

    request.onsuccess = function () {
        // make redirect
        url = new URL(redirect_url, window.location.origin)
        url.searchParams.set('id', note_id)
        console.log(url.href)
        window.location.replace(url.href)
    }
    request.onerror = function () {
        console.log("Ошибка", request.error)
    }
}

$(document).ready(function () {
    let form = document.forms['upload']
    form.elements['auth'].value = auth

    $('#upload').on('submit', function (event) {
        // do not send form to server automatically
        event.preventDefault()

        let form = document.forms['upload']
        if (!form.elements['auth'].value) {
            return
        }
        // save authorization data
        localStorage.setItem(AUTH_KEY, form.elements['auth'].value)

        console.log(form.elements['file'].files[0])

        let file = form.elements['file'].files[0]
        let data = new FormData();
        data.append('file', file);
        data.append('auth', form.elements['auth'].value)

        $.post({
            url: '/convert',
            processData: false,
            contentType: false,
            data: data,

            success: function (response) {
                success_recognize(response, file)
            }
        })
    })
})

function success_recognize(response, file) {
    console.log(response)
    if (!response['text'] || !response['redirect_url']) {
        console.error("Incorrect response")
        return
    }

    file.arrayBuffer().then((arrayBuffer) => {
        console.log("length ", arrayBuffer)
        const blob = new Blob([new Uint8Array(arrayBuffer)], { type: file.type });
        console.log(blob);

        db_event.dispatchEvent(new CustomEvent(
            'add',
            {
                detail: {
                    'text': response['text'],
                    'audio': blob,
                    'redirect_url': response['redirect_url']
                }
            }
        ))
    });


}
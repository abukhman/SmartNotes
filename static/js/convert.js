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
    let loading = $('#loading')
    loading.hide()

    let form = document.forms['upload']
    form.elements['auth'].value = auth

    $('#upload').on('submit', async function (event) {
        // do not send form to server automatically
        event.preventDefault()
        loading.show()
        loading.text('Loading started...')

        let form = document.forms['upload']
        if (!form.elements['auth'].value) {
            loading.hide()
            alert("There is no auth information")
            return
        }
        // save authorization data
        localStorage.setItem(AUTH_KEY, form.elements['auth'].value)

        var file = form.elements['file'].files[0]
        var reader = new FileReader();

        reader.onload = function () {
            recognize_file(loading, form, reader.result)
        };

        reader.readAsDataURL(file);
    })
})

function recognize_file(loading, form, blob) {
    let file = form.elements['file'].files[0]
    let data = new FormData()
    data.append('file', file)
    data.append('auth', form.elements['auth'].value)

    loading.text('Loading on server...')

    $.post({
        url: '/convert',
        processData: false,
        contentType: false,
        data: data,

        success: function (response) {
            success_recognize(loading, response, blob)
        },
        error: function (response) {
            loading.hide()
            alert("Error on server occured. Please, try again later.")
            console.error(response)
        }
    })
}

function success_recognize(loading, response, blob) {
    loading.text('Got answer, saving data...')

    console.log(response)

    if (!response['text'] || !response['redirect_url']) {
        loading.hide()
        alert("Invalid data from server. Please, try again later.")
        console.error("Incorrect response")
        return
    }

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
}
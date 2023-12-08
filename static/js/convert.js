let AUTH_KEY = 'authorization-data'
// check if there is saved auth data
let auth = localStorage.getItem(AUTH_KEY) || ''

let db_event = new EventTarget()
let openRequest = indexedDB.open('smart_notes', 2)

// init and upgrade
openRequest.onupgradeneeded = function () {
    let db = openRequest.result

    if (!db.objectStoreNames.contains('notes')) {
        // id, name, audio, text, notes, words
        db.createObjectStore('notes', { keyPath: 'id' })
    }

    if (!db.objectStoreNames.contains('tasks')) {
        // note_id, task_id, file_id, status. dt_added, dt_complete
        db.createObjectStore('tasks', { keyPath: 'note_id' })
    }
}

openRequest.onerror = function () {
    console.error("Error", openRequest.error)
}

openRequest.onsuccess = function () {
    let db = openRequest.result

    db_event.addEventListener('add_note', function (event) {
        console.log(event)

        let note_id = crypto.randomUUID()

        let redirect_url = event.detail['redirect_url']
        url = new URL(redirect_url, window.location.origin)
        url.searchParams.set('id', note_id)

        let add_note = addNote(db,
            note_id,
            event.detail['audio'],
            event.detail['text'],
            [])

        add_note.onsuccess = function () {
            window.location.replace(url.href)
        }
        add_note.onerror = function () {
            console.log("Error while adding new note", request.error)
        }
    })

    db_event.addEventListener('add_task', function (event) {
        console.log(event)

        let note_id = crypto.randomUUID()

        let add_note = addNote(db, note_id, event.detail['audio'], "")

        add_note.onsuccess = function () {
            let add_task = addTask(db, note_id, event.detail['task_id'], event.detail['file_id'])

            add_task.onsuccess = function () {
                waitTask(note_id, event.detail['task_id'])
            }
            add_task.onerror = function () {
                console.log("Error while adding new task", request.error)
            }
        }
        add_note.onerror = function () {
            console.log("Error while adding new note", request.error)
        }
    })

    db_event.addEventListener('update_note', function (event) {
        console.log(event)

        let note_id = event.detail['note_id']

        let redirect_url = event.detail['redirect_url']
        url = new URL(redirect_url, window.location.origin)
        url.searchParams.set('id', note_id)

        updateNote(db, note_id, event.detail['text'], event.detail['words'], function () {
            let delete_task = deleteTask(db, note_id)

            delete_task.onsuccess = function () {
                window.location.replace(url.href)
            }
            delete_task.onerror = function () {
                console.log("Error while deleting task", request.error)
            }
        })
    })
};


function addNote(db, id, audio, text, words) {
    let transaction = db.transaction('notes', 'readwrite')
    let notes = transaction.objectStore('notes')

    let note = {
        id: id,
        name: 'New Note',
        audio: audio,
        text: text,
        notes: '',
        words: words,
    }

    return notes.add(note)
}


function addTask(db, note_id, task_id, file_id) {
    let transaction = db.transaction('tasks', 'readwrite')
    let tasks = transaction.objectStore('tasks')

    let task = {
        note_id: note_id,
        task_id: task_id,
        file_id: file_id,
    }

    return tasks.add(task)
}


function updateNote(db, note_id, text, words, success_handler) {
    let transaction = db.transaction('notes', 'readwrite')
    let notes = transaction.objectStore('notes')

    let note = notes.get(note_id)

    note.onsuccess = function (event) {
        if (note.result == undefined) {
            console.error('No such note is presented')
            return
        }

        let updateData = note.result

        updateData.text = text
        updateData.words = words

        let request = notes.put(updateData)
        request.onsuccess = success_handler
        request.onerror = function () {
            console.log("Error while update note", note_id, request.error)
        }
    }
}


function deleteTask(db, note_id) {
    let transaction = db.transaction('tasks', 'readwrite')
    let tasks = transaction.objectStore('tasks')

    return tasks.delete(note_id)
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

        // save current authorization data
        localStorage.setItem(AUTH_KEY, form.elements['auth'].value)

        var file = form.elements['file'].files[0]
        var reader = new FileReader();

        reader.onload = function () {
            sendForm(loading, form, reader.result)
        };

        reader.readAsDataURL(file);
    })
})


function sendForm(loading, form, blob) {
    let file = form.elements['file'].files[0]

    let kind = form.elements['kind'].value
    console.log(kind)
    if (kind != 'sync' && kind != 'async') {
        kind = 'sync'
    }

    let data = new FormData()
    data.append('file', file)
    data.append('auth', form.elements['auth'].value)
    data.append('kind', kind)

    loading.text('Loading on server...')

    $.post({
        url: '/convert',
        processData: false,
        contentType: false,
        data: data,

        success: function (response) {
            loading.text('Got answer, saving data...')

            if (kind == "sync") {
                successSync(loading, response, blob)
            } else if (kind == "async") {
                successAsync(loading, response, blob)
            }
        },
        error: function (response) {
            loading.hide()
            alert("Error on server occured. Please, try again later.")
            console.error(response)
        }
    })
}


function successSync(loading, response, blob) {
    console.log(response)

    if (!response['redirect_url']) {
        loading.hide()
        alert("Invalid data from server. Please, try again later.")
        console.error("Incorrect response")
        return
    }

    db_event.dispatchEvent(new CustomEvent(
        'add_note',
        {
            detail: {
                'text': response['text'],
                'audio': blob,
                'redirect_url': response['redirect_url']
            }
        }
    ))
}


function successAsync(loading, response, blob) {
    console.log(response)

    db_event.dispatchEvent(new CustomEvent(
        'add_task',
        {
            detail: {
                'file_id': response['file_id'],
                'task_id': response['task_id'],
                'audio': blob,
            }
        }
    ))
}

// check task every 5 secs?
function waitTask(note_id, task_id) {
    let loading = $('#loading')
    loading.text('Task is running... It might take some time.')

    let auth = localStorage.getItem(AUTH_KEY) || ''
    if (auth == '') {
        loading.hide()
        alert("There is no auth information")
        return
    }

    let checkTask = function () {
        loading.text('Update the information...')

        let data = new FormData()
        data.append('auth', auth)
        data.append('task_id', task_id)

        $.post({
            url: '/check',
            processData: false,
            contentType: false,
            data: data,

            success: function (response) {
                let status = response['status']

                if (status == "RUNNING" || status == "NEW") {
                    let date = new Date()
                    loading.text("Task is running... It might take some time.\nLast update: " + date.toLocaleString())
                } else if (status == "CANCELED") {
                    alert("Task was canceled.")
                    loading.hide()
                    clearInterval(timer)
                } else if (status == "ERROR") {
                    alert("Error while running task occured. Please, try again later.")
                    loading.hide()
                    clearInterval(timer)
                } else if (status == "DONE") {
                    clearInterval(timer)
                    downloadTask(note_id, task_id)
                }
            },
            error: function (response) {
                loading.hide()
                alert("Error on server occured. Please, try again later.")
                console.error(response)
                clearInterval(timer)
            }
        })
    }

    checkTask()
    let timer = setInterval(checkTask, 5 * 1000)
}


function downloadTask(note_id, task_id) {
    // download and update
    let loading = $('#loading')
    loading.text('Task is completed. Dowloading the result...')

    let data = new FormData()
    data.append('auth', auth)
    data.append('task_id', task_id)

    $.post({
        url: '/download',
        processData: false,
        contentType: false,
        data: data,

        success: function (response) {
            console.log(response)

            db_event.dispatchEvent(new CustomEvent(
                'update_note',
                {
                    detail: {
                        'note_id': note_id,
                        'text': response['text'],
                        'words': response['words'],
                        'redirect_url': response['redirect_url']
                    }
                }
            ))
        },

        error: function (response) {
            loading.hide()
            alert("Error on server occured. Please, try again later.")
            console.error(response)
        }
    })
}
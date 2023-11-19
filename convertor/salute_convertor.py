import datetime as dt
import json, uuid, requests, enum
from werkzeug.datastructures import FileStorage
from convertor.convertor import Convertor

url_auth = "https://ngw.devices.sberbank.ru:9443/api/v2/oauth"
url_upload = "https://smartspeech.sber.ru/rest/v1/data:upload"
url_async = "https://smartspeech.sber.ru/rest/v1/speech:async_recognize"
url_sync = "https://smartspeech.sber.ru/rest/v1/speech:recognize"
url_get = "https://smartspeech.sber.ru/rest/v1/task:get"
url_download = "https://smartspeech.sber.ru/rest/v1/data:download"

class StatusType(enum.StrEnum):
    Undefined = "UNDEFINED"
    New = "NEW"
    Running = "RUNNING"
    Canceled = "CANCELED"
    Done = "DONE"
    Error = "ERROR"

class SaluteConvertor(Convertor):
    def __init__(self):
        self.token = ""
        self.expires = dt.datetime.now()

    def login(self, secret, scope="SALUTE_SPEECH_PERS"):
        request_uuid = uuid.uuid4()
        headers = {"Authorization": "Basic %s" %secret, "RqUID": str(request_uuid)}

        response: requests.Response
        try:
            response = requests.post(url_auth, headers=headers, data={"scope": scope})
        except Exception as e:
            print(e)
            return

        if not response.ok:
            print(response.json())
            return

        data = response.json()

        self.token = data.get("access_token", "")
        self.expires = dt.datetime.fromtimestamp(data.get("expires_at", 0) / 1000.0)

    def sync_recognition(self, mimetype, stream):
        if self.token == "" or dt.datetime.now() > self.expires:
            print("login token was expired")
            return

        headers={"Authorization": "Bearer %s" %self.token,
                 "Content-Type": mimetype}

        data = stream.read()
        stream.close()

        response: requests.Response
        try:
            response = requests.post(url_sync, headers=headers, data=data)
        except Exception as e:
            print(e)
            return

        if not response.ok:
            print(response.json())
            return

        data = response.json()
        if data.get("status", 0) != 200:
            print(data)
            return

        return data.get("result", [])


    def load_file(self, file) -> str | None:
        if len(self.token) == 0 or dt.datetime.now() > dt.datetime.fromtimestamp(self.expires):
            # to-do сказать пользователю об этом
            return

        headers = {"Authorization": "Bearer "+self.token}
        response = requests.post(url_upload, headers=headers, data=file)

        if response.status_code != 200:
            print(response.json())
            return

        return response.json()["result"]["request_file_id"]

    # create task for uploaded file
    def create_task(self, file_id) -> str | None:
        headers = {"Authorization": "Bearer %s" %self.token}
        params = {
            "request_file_id": file_id,
            "options": {
                "audio_encoding": "OPUS",
                "language": "ru-RU",
            }
        }

        response = requests.post(url_async, headers=headers, data=json.dumps(params, indent = 4))
        if response.status_code != 200:
            print(response.json())
            return

        return response.json()["result"]["id"]


    def check_task(self, task_id):
        headers = {"Authorization": "Bearer %s" %self.token}

        response = requests.get(url_get, headers=headers, data={"id": task_id})
        if response.status_code != 200:
            print(response.json())
            return
        return response.json()["result"]["status"], response.json()["result"]["request_file_id"]

    def download_file(self, response_id):
        headers = {"Authorization": "Bearer %s" %self.token}

        response = requests.get(url_download, headers=headers, data={"response_file_id": response_id})
        if response.status_code != 200:
            print(response.json())
            return
        return response

    def convert_data(self, data):
        pass

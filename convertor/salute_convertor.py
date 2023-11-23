import datetime as dt
import json, uuid, requests, enum
from werkzeug.datastructures import FileStorage
from convertor.convertor import Convertor
from app import app

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

    def get_token(self, secret, scope="SALUTE_SPEECH_PERS") -> str:
        request_uuid = uuid.uuid4()
        headers = {"Authorization": "Basic %s" % secret, "RqUID": str(request_uuid)}

        response: requests.Response
        try:
            response = requests.post(
                url_auth,
                headers=headers,
                data={"scope": scope},
                verify=app.config["CERT_PATH"],
            )
        except Exception as e:
            app.logger.error("unable to get auth token: %s", e)
            return ""

        if not response.ok:
            app.logger.warning("got bad response: %s", response.json())
            return ""

        data = response.json()

        self.token = data.get("access_token", "")
        self.expires = dt.datetime.fromtimestamp(data.get("expires_at", 0) / 1000.0)

        return self.token

    def sync_recognition(self, mimetype, stream):
        if self.token == "" or dt.datetime.now() > self.expires:
            app.logger.info(
                "token is expired or do not exist: token: %s, expired_at: %s",
                self.token,
                self.expires,
            )
            return

        headers = {"Authorization": "Bearer %s" % self.token, "Content-Type": mimetype}

        file = stream.read()
        stream.close()

        response: requests.Response
        try:
            response = requests.post(
                url_sync,
                headers=headers,
                data=file,
                verify=app.config["CERT_PATH"],
            )
        except Exception as e:
            app.logger.error("unable to sync recognize: %s", e)
            return

        if not response.ok:
            app.logger.warning("got bad response: %s", response.json())
            return

        data = response.json()
        if data.get("status", 0) != 200:
            app.logger.warning("got bad response: %s", data)
            return

        return data.get("result", [])

    def async_recognition(self, mimetype, stream):
        request_file_id = self.load_file()
        if len(request_file_id) == 0:
            app.logger.error("unable to get request_file_id")
            return

        self.create_task()

    def load_file(self, mimetype, stream) -> str:
        if self.token == "" or dt.datetime.now() > self.expires:
            app.logger.info(
                "token is expired or do not exist: token: %s, expired_at: %s",
                self.token,
                self.expires,
            )
            return ""

        headers = {"Authorization": "Bearer %s" % self.token, "Content-Type": mimetype}

        file = stream.read()
        stream.close()

        response: requests.Response
        try:
            response = requests.post(
                url_upload,
                headers=headers,
                data=file,
                verify=app.config["CERT_PATH"],
            )
        except Exception as e:
            app.logger.error("unable to upload file: %s", e)
            return ""

        if not response.ok:
            app.logger.warning("got bad response: %s", response.json())
            return ""

        data = response.json()
        if data.get("status", 0) != 200:
            app.logger.warning("got bad response: %s", data)
            return ""

        result = data.get("result", {})
        return result.get("request_file_id", "")

    # create task for uploaded file
    def create_task(self, file_id) -> str:
        headers = {"Authorization": "Bearer %s" % self.token}
        params = {
            "request_file_id": file_id,
            "options": {
                "audio_encoding": "OPUS",
                "language": "ru-RU",
            },
        }

        response: requests.Response
        try:
            response = requests.post(
                url_async,
                headers=headers,
                data=json.dumps(params, indent=4),
                verify=app.config["CERT_PATH"],
            )
        except Exception as e:
            app.logger.error("unable to upload file: %s", e)
            return ""

        if not response.ok:
            app.logger.warning("got bad response: %s", response.json())
            return ""

        data = response.json()
        if data.get("status", 0) != 200:
            app.logger.warning("got bad response: %s", data)
            return ""

        result = data.get("result", {})
        return result.get("id", "")

    def check_task(self, task_id):
        headers = {"Authorization": "Bearer %s" % self.token}

        response = requests.get(
            url_get,
            headers=headers,
            data={"id": task_id},
            verify=app.config["CERT_PATH"],
        )
        if response.status_code != 200:
            print(response.json())
            return
        return (
            response.json()["result"]["status"],
            response.json()["result"]["request_file_id"],
        )

    def download_file(self, response_id):
        headers = {"Authorization": "Bearer %s" % self.token}

        response = requests.get(
            url_download,
            headers=headers,
            data={"response_file_id": response_id},
            verify=app.config["CERT_PATH"],
        )
        if response.status_code != 200:
            print(response.json())
            return
        return response

    def check_and_download(self, task_id) -> list | None:
        result = self.check_task(task_id)
        if result[0] == "DONE":
            return self.download_file(result[1])

        return None

    def convert_data(self, data):
        pass
        pass

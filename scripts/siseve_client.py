"""
Cliente HTTP para el portal publico SiseVe (MINEDU Peru).

Solo consume endpoints que el propio portal invoca desde el navegador de
cualquier ciudadano, sin autenticacion. No se evade ningun control de acceso:
la capa AES que se implementa aqui es una ofuscacion del lado del cliente cuya
clave el servidor entrega en el HTML publico de la pagina.
"""
import base64
import json
import re
import urllib.parse

import requests
from Crypto.Cipher import AES
from Crypto.Util.Padding import pad, unpad

BASE = "https://siseve.minedu.gob.pe/Web"
UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36")

# Diccionario letra->digito de AppJs/utils/app-config.js (_getDicKeyStringToNumber)
S2N = {"L": "0", "G": "1", "A": "2", "q": "3", "t": "4",
       "P": "5", "Z": "6", "B": "7", "M": "8", "S": "9"}


def _aes_decrypt(b64_text: str, key: str) -> str:
    """AES-128-CBC con IV == key, igual que CryptoJS en el portal."""
    k = key.encode()
    cipher = AES.new(k, AES.MODE_CBC, k)
    return unpad(cipher.decrypt(base64.b64decode(b64_text)), AES.block_size).decode("utf-8")


def _aes_encrypt(text: str, key: str) -> str:
    k = key.encode()
    cipher = AES.new(k, AES.MODE_CBC, k)
    blob = base64.b64encode(cipher.encrypt(pad(text.encode(), AES.block_size))).decode()
    return urllib.parse.quote(blob, safe="")


class SiseveClient:
    """Reproduce la funcion AjaxService() de /Web/bundles/js-site."""

    def __init__(self, timeout: int = 90):
        self.timeout = timeout
        self.session = requests.Session()
        self.session.headers.update({"User-Agent": UA})
        self._bootstrap()

    def _bootstrap(self):
        """Obtiene la 'keyInstance' del div#divTheme y deriva la clave AES."""
        html = self.session.get(f"{BASE}/App/Mapa", timeout=self.timeout).text
        m = re.search(r'id="divTheme"\s+data-url="([^"]+)"', html)
        if not m:
            raise RuntimeError("No se encontro data-url en #divTheme; el portal cambio.")
        self.instance = m.group(1)

        # getKey(): los 8 primeros y 8 ultimos caracteres se traducen a digitos y
        # se concatenan -> clave intermedia de 16 bytes. El texto del medio se
        # descifra con ella y produce la clave AES real usada en las peticiones.
        k1 = "".join(S2N[c] for c in self.instance[:8])
        k2 = "".join(S2N[c] for c in self.instance[-8:])
        middle = urllib.parse.unquote(self.instance[8:len(self.instance) - 8])
        self.key = _aes_decrypt(middle, k1 + k2)

    def call(self, path: str, data: dict | None = None):
        """POST JSON. Si hay payload va cifrado en {'filter': ...}."""
        body = ""
        if data is not None:
            body = json.dumps({"filter": _aes_encrypt(json.dumps(data), self.key)})

        resp = self.session.post(
            BASE + path,
            data=body,
            headers={"Content-Type": "application/json; charset=utf-8",
                     "X-Requested-With": "XMLHttpRequest"},
            timeout=self.timeout,
        )
        resp.raise_for_status()
        payload = resp.json()
        # El servidor devuelve un string cifrado (mismo esquema) o el JSON plano.
        if isinstance(payload, str):
            return json.loads(_aes_decrypt(urllib.parse.unquote(payload), self.key))
        return payload

    # ---- endpoints publicos -------------------------------------------------

    def listar_anios(self):
        return self.call("/TableroControl/ListarAnio")["Data"]

    def listar_datos_mapa(self, anio):
        raw = self.call("/TableroControl/ListarDatosMapa", {"ANIO": str(anio)})["Data"]
        return [json.loads(b) if isinstance(b, str) else b for b in raw]

    def listar_dre_ugel(self):
        return self.call("/TableroControl/ListarDreUgel")["Data"]

    def _graficos(self, path, payload):
        raw = self.call(path, payload)["Data"]
        return [json.loads(b)[0] if isinstance(b, str) else b for b in raw]

    def grafico_nacional(self, anio):
        return self._graficos("/TableroControl/ListarDatosGraficoNacional",
                              {"ANIO": str(anio)})

    def grafico_region(self, anio, codigo_mapa):
        return self._graficos("/TableroControl/ListarDatosGraficoRegion",
                              {"ANIO": str(anio), "CODIGO_MAPA": codigo_mapa})

    def grafico_ugel(self, anio, codigo_mapa, codigo_ugel):
        return self._graficos("/TableroControl/ListarDatosGraficoUgel",
                              {"ANIO": str(anio), "CODIGO_MAPA": codigo_mapa,
                               "CODIGO_UGEL": codigo_ugel})

    def descargar_excel(self, destino):
        """POST /Inicio/DescargarEXCEL -> xlsx con el listado de casos."""
        resp = self.session.post(
            BASE + "/Inicio/DescargarEXCEL",
            data="",
            headers={"X-Requested-With": "XMLHttpRequest"},
            timeout=300,
        )
        resp.raise_for_status()
        with open(destino, "wb") as fh:
            fh.write(resp.content)
        return destino

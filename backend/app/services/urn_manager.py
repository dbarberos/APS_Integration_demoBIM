"""
Gestor de URNs para APS - Validación, generación y encriptación segura
"""
import base64
import hashlib
import hmac
import re
import secrets
from typing import Dict, List, Optional, Tuple
from urllib.parse import quote, unquote
import structlog
from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC

from app.core.config import settings

logger = structlog.get_logger()


class URNValidationError(Exception):
    """Error de validación de URN"""
    pass


class URNEncryptionError(Exception):
    """Error de encriptación de URN"""
    pass


class URNManager:
    """Gestor completo de URNs de APS"""
    
    # Patrones de URN válidos
    URN_PATTERNS = {
        'object': re.compile(r'^urn:adsk\.objects:os\.object:[a-zA-Z0-9_-]+\/[a-zA-Z0-9._-]+$'),
        'derivative': re.compile(r'^urn:adsk\.viewing:fs\.file:[a-zA-Z0-9_-]+\/[a-zA-Z0-9._-]+\/output\/[a-zA-Z0-9._-]+$'),
        'manifest': re.compile(r'^urn:adsk\.viewing:fs\.file:[a-zA-Z0-9_-]+\/[a-zA-Z0-9._-]+$'),
        'encoded': re.compile(r'^[A-Za-z0-9+/=]+$'),  # Base64 encoded URN
    }
    
    # Tipos de URN soportados
    URN_TYPES = {
        'OSS_OBJECT': 'urn:adsk.objects:os.object',
        'VIEWING_FILE': 'urn:adsk.viewing:fs.file',
        'DATA_FILE': 'urn:adsk.data:fs.file',
        'DERIVATIVE': 'urn:adsk.viewing:fs.file'
    }
    
    def __init__(self):
        self._encryption_key = self._derive_encryption_key()
        self._cipher = Fernet(self._encryption_key)
    
    def _derive_encryption_key(self) -> bytes:
        """Derivar clave de encriptación de la configuración"""
        try:
            # Usar SECRET_KEY como base para derivar clave de encriptación
            password = settings.SECRET_KEY.encode()
            salt = b'aps_urn_encryption_salt_v1'  # Salt fijo para consistencia
            
            kdf = PBKDF2HMAC(
                algorithm=hashes.SHA256(),
                length=32,
                salt=salt,
                iterations=100000,
            )
            
            return base64.urlsafe_b64encode(kdf.derive(password))
            
        except Exception as e:
            logger.error("Error derivando clave de encriptación", error=str(e))
            raise URNEncryptionError(f"No se pudo derivar clave de encriptación: {e}")
    
    def validate_urn(self, urn: str, urn_type: str = None) -> bool:
        """
        Validar formato de URN
        
        Args:
            urn: URN a validar
            urn_type: Tipo específico a validar (opcional)
            
        Returns:
            True si es válido
            
        Raises:
            URNValidationError: Si es inválido
        """
        try:
            if not urn or not isinstance(urn, str):
                raise URNValidationError("URN debe ser string no vacío")
            
            # Limpiar URN
            clean_urn = urn.strip()
            
            # Si está codificado en base64, decodificar primero
            if self._is_base64_encoded(clean_urn):
                try:
                    decoded_urn = base64.b64decode(clean_urn).decode('utf-8')
                    clean_urn = decoded_urn
                except Exception:
                    raise URNValidationError("URN codificado inválido")
            
            # Validar longitud
            if len(clean_urn) > 1000:  # Límite razonable
                raise URNValidationError("URN demasiado largo")
            
            # Validar caracteres permitidos
            if not re.match(r'^[a-zA-Z0-9:/.+=_-]+$', clean_urn):
                raise URNValidationError("URN contiene caracteres inválidos")
            
            # Validar estructura básica
            if not clean_urn.startswith('urn:adsk.'):
                raise URNValidationError("URN debe comenzar con 'urn:adsk.'")
            
            # Validar tipo específico si se proporciona
            if urn_type:
                if urn_type in self.URN_PATTERNS:
                    pattern = self.URN_PATTERNS[urn_type]
                    if not pattern.match(clean_urn):
                        raise URNValidationError(f"URN no coincide con patrón {urn_type}")
                else:
                    logger.warning("Tipo de URN desconocido", urn_type=urn_type)
            
            # Validaciones adicionales por tipo
            self._validate_urn_components(clean_urn)
            
            logger.debug("URN validado exitosamente", urn=clean_urn[:50] + "...")
            return True
            
        except URNValidationError:
            raise
        except Exception as e:
            logger.error("Error validando URN", urn=urn[:50] + "...", error=str(e))
            raise URNValidationError(f"Error de validación: {e}")
    
    def _is_base64_encoded(self, value: str) -> bool:
        """Verificar si un string está codificado en base64"""
        try:
            # Debe ser múltiplo de 4 y solo caracteres base64
            if len(value) % 4 != 0:
                return False
            
            return bool(self.URN_PATTERNS['encoded'].match(value))
        except Exception:
            return False
    
    def _validate_urn_components(self, urn: str):
        """Validar componentes específicos del URN"""
        parts = urn.split(':')
        
        if len(parts) < 3:
            raise URNValidationError("URN debe tener al menos 3 componentes")
        
        # Validar esquema
        if parts[0] != 'urn':
            raise URNValidationError("URN debe comenzar con 'urn'")
        
        # Validar namespace Autodesk
        if not parts[1].startswith('adsk.'):
            raise URNValidationError("Namespace debe ser de Autodesk")
        
        # Validaciones específicas por tipo
        if 'objects' in urn and 'os.object' in urn:
            self._validate_object_urn(urn)
        elif 'viewing' in urn and 'fs.file' in urn:
            self._validate_viewing_urn(urn)
    
    def _validate_object_urn(self, urn: str):
        """Validar URN de objeto OSS"""
        # Ejemplo: urn:adsk.objects:os.object:bucket_key/object_key
        parts = urn.split('/')
        if len(parts) < 2:
            raise URNValidationError("URN de objeto debe incluir bucket y object key")
        
        object_path = '/'.join(parts[1:])
        if not object_path:
            raise URNValidationError("Object key no puede estar vacío")
    
    def _validate_viewing_urn(self, urn: str):
        """Validar URN de viewing/manifest"""
        # Ejemplo: urn:adsk.viewing:fs.file:encoded_source_urn/output/...
        if '/output/' in urn:
            # Es un derivative URN
            parts = urn.split('/output/')
            if len(parts) != 2 or not parts[1]:
                raise URNValidationError("Derivative URN mal formado")
    
    def encode_urn(self, urn: str) -> str:
        """
        Codificar URN en base64 para uso en URLs
        
        Args:
            urn: URN a codificar
            
        Returns:
            URN codificado en base64
        """
        try:
            # Validar antes de codificar
            self.validate_urn(urn)
            
            # Codificar en UTF-8 y luego base64
            encoded_bytes = urn.encode('utf-8')
            encoded_urn = base64.b64encode(encoded_bytes).decode('ascii')
            
            logger.debug("URN codificado", original_length=len(urn), encoded_length=len(encoded_urn))
            return encoded_urn
            
        except Exception as e:
            logger.error("Error codificando URN", error=str(e))
            raise URNValidationError(f"No se pudo codificar URN: {e}")
    
    def decode_urn(self, encoded_urn: str) -> str:
        """
        Decodificar URN desde base64
        
        Args:
            encoded_urn: URN codificado en base64
            
        Returns:
            URN decodificado
        """
        try:
            # Decodificar desde base64
            decoded_bytes = base64.b64decode(encoded_urn)
            decoded_urn = decoded_bytes.decode('utf-8')
            
            # Validar URN decodificado
            self.validate_urn(decoded_urn)
            
            logger.debug("URN decodificado", encoded_length=len(encoded_urn), decoded_length=len(decoded_urn))
            return decoded_urn
            
        except Exception as e:
            logger.error("Error decodificando URN", error=str(e))
            raise URNValidationError(f"No se pudo decodificar URN: {e}")
    
    def encrypt_urn(self, urn: str) -> str:
        """
        Encriptar URN para almacenamiento seguro
        
        Args:
            urn: URN a encriptar
            
        Returns:
            URN encriptado
        """
        try:
            # Validar antes de encriptar
            self.validate_urn(urn)
            
            # Encriptar
            urn_bytes = urn.encode('utf-8')
            encrypted_bytes = self._cipher.encrypt(urn_bytes)
            encrypted_urn = base64.urlsafe_b64encode(encrypted_bytes).decode('ascii')
            
            logger.debug("URN encriptado", original_length=len(urn))
            return encrypted_urn
            
        except Exception as e:
            logger.error("Error encriptando URN", error=str(e))
            raise URNEncryptionError(f"No se pudo encriptar URN: {e}")
    
    def decrypt_urn(self, encrypted_urn: str) -> str:
        """
        Desencriptar URN desde almacenamiento
        
        Args:
            encrypted_urn: URN encriptado
            
        Returns:
            URN desencriptado
        """
        try:
            # Decodificar desde base64 URL-safe
            encrypted_bytes = base64.urlsafe_b64decode(encrypted_urn)
            
            # Desencriptar
            decrypted_bytes = self._cipher.decrypt(encrypted_bytes)
            decrypted_urn = decrypted_bytes.decode('utf-8')
            
            # Validar URN desencriptado
            self.validate_urn(decrypted_urn)
            
            logger.debug("URN desencriptado")
            return decrypted_urn
            
        except Exception as e:
            logger.error("Error desencriptando URN", error=str(e))
            raise URNEncryptionError(f"No se pudo desencriptar URN: {e}")
    
    def generate_object_urn(self, bucket_key: str, object_key: str) -> str:
        """
        Generar URN de objeto OSS
        
        Args:
            bucket_key: Clave del bucket
            object_key: Clave del objeto
            
        Returns:
            URN del objeto
        """
        try:
            # Validar inputs
            if not bucket_key or not object_key:
                raise URNValidationError("bucket_key y object_key son requeridos")
            
            # Sanitizar claves
            clean_bucket = self._sanitize_key(bucket_key)
            clean_object = self._sanitize_key(object_key, allow_slashes=True)
            
            # Generar URN
            urn = f"urn:adsk.objects:os.object:{clean_bucket}/{clean_object}"
            
            # Validar URN generado
            self.validate_urn(urn, 'object')
            
            logger.debug("URN de objeto generado", bucket=clean_bucket, object=clean_object)
            return urn
            
        except Exception as e:
            logger.error("Error generando URN de objeto", bucket=bucket_key, object=object_key, error=str(e))
            raise URNValidationError(f"No se pudo generar URN de objeto: {e}")
    
    def _sanitize_key(self, key: str, allow_slashes: bool = False) -> str:
        """Sanitizar clave para URN"""
        # Remover caracteres no válidos
        if allow_slashes:
            # Para object keys, permitir slashes
            sanitized = re.sub(r'[^a-zA-Z0-9._/-]', '_', key)
        else:
            # Para bucket keys, no permitir slashes
            sanitized = re.sub(r'[^a-zA-Z0-9._-]', '_', key)
        
        # Limitar longitud
        if len(sanitized) > 100:
            sanitized = sanitized[:100]
        
        return sanitized
    
    def extract_bucket_and_object(self, urn: str) -> Tuple[str, str]:
        """
        Extraer bucket_key y object_key de URN de objeto
        
        Args:
            urn: URN del objeto
            
        Returns:
            Tupla (bucket_key, object_key)
        """
        try:
            # Validar que sea URN de objeto
            self.validate_urn(urn, 'object')
            
            # Extraer la parte después de 'urn:adsk.objects:os.object:'
            prefix = 'urn:adsk.objects:os.object:'
            if not urn.startswith(prefix):
                raise URNValidationError("No es un URN de objeto válido")
            
            path_part = urn[len(prefix):]
            parts = path_part.split('/', 1)
            
            if len(parts) != 2:
                raise URNValidationError("URN de objeto mal formado")
            
            bucket_key = parts[0]
            object_key = parts[1]
            
            return bucket_key, object_key
            
        except Exception as e:
            logger.error("Error extrayendo bucket y objeto", urn=urn[:50] + "...", error=str(e))
            raise URNValidationError(f"No se pudo extraer bucket y objeto: {e}")
    
    def generate_derivative_urn(self, source_urn: str, output_type: str, guid: str = None) -> str:
        """
        Generar URN de derivative
        
        Args:
            source_urn: URN del archivo fuente
            output_type: Tipo de salida (svf, svf2, etc.)
            guid: GUID específico (opcional)
            
        Returns:
            URN del derivative
        """
        try:
            # Validar URN fuente
            self.validate_urn(source_urn)
            
            # Codificar URN fuente
            encoded_source = self.encode_urn(source_urn)
            
            # Generar GUID si no se proporciona
            if not guid:
                guid = secrets.token_hex(16)
            
            # Generar URN de derivative
            derivative_urn = f"urn:adsk.viewing:fs.file:{encoded_source}/output/{output_type}/{guid}"
            
            logger.debug("URN de derivative generado", 
                        source=source_urn[:50] + "...",
                        output_type=output_type,
                        guid=guid)
            
            return derivative_urn
            
        except Exception as e:
            logger.error("Error generando URN de derivative", error=str(e))
            raise URNValidationError(f"No se pudo generar URN de derivative: {e}")
    
    def create_signed_urn(self, urn: str, expires_in: int = 3600) -> str:
        """
        Crear URN firmado con expiración
        
        Args:
            urn: URN a firmar
            expires_in: Tiempo de expiración en segundos
            
        Returns:
            URN firmado
        """
        try:
            import time
            
            # Validar URN
            self.validate_urn(urn)
            
            # Crear timestamp de expiración
            expires_at = int(time.time()) + expires_in
            
            # Crear payload
            payload = f"{urn}:{expires_at}"
            
            # Crear firma HMAC
            signature = hmac.new(
                settings.SECRET_KEY.encode(),
                payload.encode(),
                hashlib.sha256
            ).hexdigest()
            
            # Crear URN firmado
            signed_urn = f"{self.encode_urn(urn)}:{expires_at}:{signature}"
            
            logger.debug("URN firmado creado", expires_in=expires_in)
            return signed_urn
            
        except Exception as e:
            logger.error("Error creando URN firmado", error=str(e))
            raise URNValidationError(f"No se pudo crear URN firmado: {e}")
    
    def verify_signed_urn(self, signed_urn: str) -> Tuple[str, bool]:
        """
        Verificar URN firmado
        
        Args:
            signed_urn: URN firmado a verificar
            
        Returns:
            Tupla (urn_original, es_valido)
        """
        try:
            import time
            
            # Parsear URN firmado
            parts = signed_urn.split(':')
            if len(parts) < 3:
                return "", False
            
            encoded_urn = parts[0]
            expires_at = int(parts[1])
            signature = parts[2]
            
            # Verificar expiración
            if time.time() > expires_at:
                logger.warning("URN firmado expirado")
                return "", False
            
            # Decodificar URN
            original_urn = self.decode_urn(encoded_urn)
            
            # Recrear payload y verificar firma
            payload = f"{original_urn}:{expires_at}"
            expected_signature = hmac.new(
                settings.SECRET_KEY.encode(),
                payload.encode(),
                hashlib.sha256
            ).hexdigest()
            
            is_valid = hmac.compare_digest(signature, expected_signature)
            
            if is_valid:
                logger.debug("URN firmado verificado exitosamente")
            else:
                logger.warning("Firma de URN inválida")
            
            return original_urn, is_valid
            
        except Exception as e:
            logger.error("Error verificando URN firmado", error=str(e))
            return "", False
    
    def get_urn_info(self, urn: str) -> Dict[str, str]:
        """
        Obtener información del URN
        
        Args:
            urn: URN a analizar
            
        Returns:
            Diccionario con información del URN
        """
        try:
            # Validar URN
            self.validate_urn(urn)
            
            info = {
                'urn': urn,
                'encoded_urn': self.encode_urn(urn),
                'type': 'unknown',
                'namespace': '',
                'service': '',
                'resource_type': ''
            }
            
            # Parsear componentes
            if urn.startswith('urn:adsk.objects:os.object:'):
                info['type'] = 'object'
                info['namespace'] = 'adsk.objects'
                info['service'] = 'oss'
                info['resource_type'] = 'object'
                
                try:
                    bucket_key, object_key = self.extract_bucket_and_object(urn)
                    info['bucket_key'] = bucket_key
                    info['object_key'] = object_key
                except Exception:
                    pass
                    
            elif urn.startswith('urn:adsk.viewing:fs.file:'):
                info['type'] = 'viewing'
                info['namespace'] = 'adsk.viewing'
                info['service'] = 'viewing'
                info['resource_type'] = 'file'
                
                if '/output/' in urn:
                    info['is_derivative'] = True
                else:
                    info['is_derivative'] = False
            
            logger.debug("Información de URN extraída", urn_type=info['type'])
            return info
            
        except Exception as e:
            logger.error("Error obteniendo información de URN", error=str(e))
            return {'urn': urn, 'error': str(e)}
    
    def batch_validate_urns(self, urns: List[str]) -> Dict[str, bool]:
        """
        Validar múltiples URNs
        
        Args:
            urns: Lista de URNs a validar
            
        Returns:
            Diccionario con resultados de validación
        """
        results = {}
        
        for urn in urns:
            try:
                self.validate_urn(urn)
                results[urn] = True
            except Exception as e:
                logger.warning("URN inválido en batch", urn=urn[:50] + "...", error=str(e))
                results[urn] = False
        
        valid_count = sum(results.values())
        logger.info("Validación batch completada", 
                   total=len(urns), 
                   valid=valid_count, 
                   invalid=len(urns) - valid_count)
        
        return results


# Instancia global del gestor de URNs
urn_manager = URNManager()

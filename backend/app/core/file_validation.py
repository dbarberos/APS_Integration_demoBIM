"""
Validación y seguridad de archivos
"""
import hashlib
import magic
import os
import re
import time
from typing import Dict, List, Optional, BinaryIO, Tuple
from pathlib import Path
import structlog
from fastapi import HTTPException, status, UploadFile

from app.core.config import settings

logger = structlog.get_logger()


class FileValidator:
    """Validador completo de archivos"""
    
    # Tipos MIME permitidos con sus extensiones correspondientes
    ALLOWED_MIME_TYPES = {
        # Revit
        'application/octet-stream': ['.rvt', '.rfa', '.rte'],
        
        # AutoCAD
        'application/x-dwg': ['.dwg'],
        'image/vnd.dwg': ['.dwg'],
        'application/acad': ['.dwg'],
        'application/x-autocad': ['.dwg'],
        'image/x-dwg': ['.dwg'],
        'application/autocad_dwg': ['.dwg'],
        'application/x-acad': ['.dwg'],
        'image/x-autocad': ['.dwg'],
        
        # IFC
        'application/x-step': ['.ifc'],
        'model/ifc': ['.ifc'],
        'application/ifc': ['.ifc'],
        
        # 3D Models
        'model/3mf': ['.3mf'],
        'application/x-3ds': ['.3ds'],
        'model/vnd.3ds': ['.3ds'],
        'application/x-fbx': ['.fbx'],
        'model/obj': ['.obj'],
        'application/x-tgif': ['.obj'],
        
        # Rhino
        'application/x-rhinoceros-3d': ['.3dm'],
        
        # SketchUp
        'application/x-sketchup': ['.skp'],
        
        # Point Clouds
        'application/x-pointcloud': ['.pts', '.xyz', '.las', '.laz'],
        
        # Documents
        'application/pdf': ['.pdf'],
        'image/jpeg': ['.jpg', '.jpeg'],
        'image/png': ['.png'],
        'image/tiff': ['.tif', '.tiff']
    }
    
    # Extensiones peligrosas nunca permitidas
    DANGEROUS_EXTENSIONS = {
        '.exe', '.bat', '.cmd', '.com', '.pif', '.scr', '.vbs', '.js',
        '.jar', '.app', '.deb', '.pkg', '.dmg', '.iso', '.msi', '.run',
        '.sh', '.ps1', '.vb', '.wsf', '.hta', '.cpl', '.scf'
    }
    
    # Firmas de archivos conocidas (magic numbers)
    FILE_SIGNATURES = {
        b'\x50\x4B\x03\x04': '.zip',  # ZIP/Office docs
        b'\x89\x50\x4E\x47': '.png',  # PNG
        b'\xFF\xD8\xFF': '.jpg',      # JPEG
        b'\x25\x50\x44\x46': '.pdf',  # PDF
        b'\x41\x43\x31\x30': '.dwg',  # AutoCAD DWG
    }
    
    def __init__(self):
        self.max_file_size = settings.MAX_FILE_SIZE
        self.allowed_extensions = settings.ALLOWED_EXTENSIONS
    
    async def validate_file(
        self,
        file: UploadFile,
        user_id: int,
        check_quota: bool = True
    ) -> Dict[str, any]:
        """
        Validación completa de archivo
        
        Returns:
            Dict con información del archivo validado
        """
        try:
            validation_result = {
                'is_valid': False,
                'file_info': {},
                'security_checks': {},
                'errors': []
            }
            
            # 1. Validaciones básicas
            basic_validation = await self._validate_basic_properties(file)
            validation_result['file_info'].update(basic_validation)
            
            if basic_validation.get('errors'):
                validation_result['errors'].extend(basic_validation['errors'])
                return validation_result
            
            # 2. Validación de contenido y MIME type
            content_validation = await self._validate_file_content(file)
            validation_result['security_checks'].update(content_validation)
            
            if content_validation.get('errors'):
                validation_result['errors'].extend(content_validation['errors'])
                return validation_result
            
            # 3. Validación de cuota de usuario
            if check_quota:
                quota_validation = await self._validate_user_quota(
                    user_id, 
                    basic_validation['size']
                )
                validation_result['security_checks'].update(quota_validation)
                
                if quota_validation.get('errors'):
                    validation_result['errors'].extend(quota_validation['errors'])
                    return validation_result
            
            # 4. Escaneo de seguridad básico
            security_validation = await self._validate_file_security(file)
            validation_result['security_checks'].update(security_validation)
            
            if security_validation.get('errors'):
                validation_result['errors'].extend(security_validation['errors'])
                return validation_result
            
            validation_result['is_valid'] = True
            logger.info("Archivo validado exitosamente",
                       filename=file.filename,
                       size_mb=round(basic_validation['size'] / (1024*1024), 2),
                       user_id=user_id)
            
            return validation_result
            
        except Exception as e:
            logger.error("Error durante validación de archivo", error=str(e))
            validation_result['errors'].append(f"Error interno de validación: {str(e)}")
            return validation_result
    
    async def _validate_basic_properties(self, file: UploadFile) -> Dict[str, any]:
        """Validar propiedades básicas del archivo"""
        result = {'errors': []}
        
        try:
            # Validar nombre de archivo
            if not file.filename:
                result['errors'].append("Nombre de archivo requerido")
                return result
            
            # Limpiar nombre de archivo
            clean_filename = self._sanitize_filename(file.filename)
            if clean_filename != file.filename:
                logger.warning("Nombre de archivo sanitizado",
                             original=file.filename,
                             sanitized=clean_filename)
            
            # Validar extensión
            file_extension = Path(clean_filename).suffix.lower()
            if not file_extension:
                result['errors'].append("Archivo debe tener una extensión válida")
                return result
            
            if file_extension in self.DANGEROUS_EXTENSIONS:
                result['errors'].append(f"Tipo de archivo peligroso no permitido: {file_extension}")
                return result
            
            if file_extension not in self.allowed_extensions:
                result['errors'].append(
                    f"Tipo de archivo no soportado: {file_extension}. "
                    f"Tipos permitidos: {', '.join(self.allowed_extensions)}"
                )
                return result
            
            # Obtener tamaño del archivo
            file_content = await file.read()
            file_size = len(file_content)
            await file.seek(0)  # Reset file pointer
            
            # Validar tamaño
            if file_size == 0:
                result['errors'].append("El archivo está vacío")
                return result
            
            if file_size > self.max_file_size:
                max_size_mb = self.max_file_size / (1024 * 1024)
                current_size_mb = file_size / (1024 * 1024)
                result['errors'].append(
                    f"Archivo demasiado grande ({current_size_mb:.1f}MB). "
                    f"Máximo permitido: {max_size_mb:.1f}MB"
                )
                return result
            
            # Calcular hash del archivo
            file_hash = hashlib.sha256(file_content).hexdigest()
            
            result.update({
                'filename': clean_filename,
                'original_filename': file.filename,
                'extension': file_extension,
                'size': file_size,
                'content_type': file.content_type,
                'sha256_hash': file_hash
            })
            
            return result
            
        except Exception as e:
            result['errors'].append(f"Error al validar propiedades básicas: {str(e)}")
            return result
    
    async def _validate_file_content(self, file: UploadFile) -> Dict[str, any]:
        """Validar contenido y MIME type del archivo"""
        result = {'errors': []}
        
        try:
            # Leer una muestra del archivo para análisis
            await file.seek(0)
            file_sample = await file.read(8192)  # Primeros 8KB
            await file.seek(0)
            
            # Detectar MIME type real usando python-magic
            try:
                detected_mime = magic.from_buffer(file_sample, mime=True)
                result['detected_mime_type'] = detected_mime
            except Exception as e:
                logger.warning("No se pudo detectar MIME type", error=str(e))
                detected_mime = None
            
            # Validar firma de archivo (magic numbers)
            file_signature = self._check_file_signature(file_sample)
            if file_signature:
                result['detected_signature'] = file_signature
            
            # Verificar que el MIME type coincida con la extensión
            file_extension = Path(file.filename).suffix.lower()
            
            if detected_mime:
                valid_mime = False
                for allowed_mime, extensions in self.ALLOWED_MIME_TYPES.items():
                    if detected_mime == allowed_mime and file_extension in extensions:
                        valid_mime = True
                        break
                    # Algunos archivos CAD pueden tener MIME genérico
                    elif detected_mime == 'application/octet-stream' and file_extension in extensions:
                        valid_mime = True
                        break
                
                if not valid_mime:
                    logger.warning("MIME type no coincide con extensión",
                                 detected_mime=detected_mime,
                                 extension=file_extension,
                                 filename=file.filename)
                    # No bloquear por esto, solo advertir
            
            # Buscar patrones sospechosos en el contenido
            suspicious_patterns = self._scan_for_malicious_patterns(file_sample)
            if suspicious_patterns:
                result['errors'].append(
                    f"Contenido sospechoso detectado: {', '.join(suspicious_patterns)}"
                )
                return result
            
            result['content_valid'] = True
            return result
            
        except Exception as e:
            result['errors'].append(f"Error al validar contenido: {str(e)}")
            return result
    
    async def _validate_user_quota(self, user_id: int, file_size: int) -> Dict[str, any]:
        """Validar cuota de almacenamiento del usuario"""
        result = {'errors': []}
        
        try:
            # TODO: Implementar consulta real a base de datos
            # Por ahora, límites simulados
            max_quota_per_user = 5 * 1024 * 1024 * 1024  # 5GB por usuario
            current_usage = 0  # Obtener del DB real
            
            if current_usage + file_size > max_quota_per_user:
                quota_mb = max_quota_per_user / (1024 * 1024)
                usage_mb = current_usage / (1024 * 1024)
                file_mb = file_size / (1024 * 1024)
                
                result['errors'].append(
                    f"Cuota de almacenamiento excedida. "
                    f"Uso actual: {usage_mb:.1f}MB, "
                    f"Archivo: {file_mb:.1f}MB, "
                    f"Límite: {quota_mb:.1f}MB"
                )
                return result
            
            result.update({
                'quota_valid': True,
                'current_usage': current_usage,
                'max_quota': max_quota_per_user,
                'remaining_quota': max_quota_per_user - current_usage
            })
            
            return result
            
        except Exception as e:
            result['errors'].append(f"Error al validar cuota: {str(e)}")
            return result
    
    async def _validate_file_security(self, file: UploadFile) -> Dict[str, any]:
        """Escaneo de seguridad básico del archivo"""
        result = {'errors': []}
        
        try:
            await file.seek(0)
            file_content = await file.read()
            await file.seek(0)
            
            # Buscar strings sospechosos
            suspicious_strings = [
                b'<script',
                b'javascript:',
                b'vbscript:',
                b'shell32.dll',
                b'kernel32.dll',
                b'CreateProcess',
                b'WScript.Shell',
                b'cmd.exe',
                b'powershell'
            ]
            
            found_suspicious = []
            for suspicious in suspicious_strings:
                if suspicious in file_content:
                    found_suspicious.append(suspicious.decode('utf-8', errors='ignore'))
            
            if found_suspicious:
                logger.warning("Strings sospechosos encontrados en archivo",
                             filename=file.filename,
                             suspicious=found_suspicious)
                # Para archivos CAD, algunos strings pueden ser falsos positivos
                # Solo alertar, no bloquear automáticamente
            
            # Verificar entropía del archivo (detectar archivos cifrados/malware)
            entropy = self._calculate_entropy(file_content[:8192])
            result['entropy'] = entropy
            
            # Entropía muy alta puede indicar cifrado o compresión
            if entropy > 7.5:
                logger.info("Alta entropía detectada",
                           filename=file.filename,
                           entropy=entropy)
            
            result['security_scan_passed'] = True
            return result
            
        except Exception as e:
            result['errors'].append(f"Error en escaneo de seguridad: {str(e)}")
            return result
    
    def _sanitize_filename(self, filename: str) -> str:
        """Sanitizar nombre de archivo"""
        # Remover caracteres peligrosos
        sanitized = re.sub(r'[<>:"/\\|?*]', '_', filename)
        
        # Limitar longitud
        name_part = Path(sanitized).stem
        extension = Path(sanitized).suffix
        
        if len(name_part) > 200:
            name_part = name_part[:200]
        
        return f"{name_part}{extension}"
    
    def _check_file_signature(self, file_content: bytes) -> Optional[str]:
        """Verificar firma de archivo (magic numbers)"""
        for signature, extension in self.FILE_SIGNATURES.items():
            if file_content.startswith(signature):
                return extension
        return None
    
    def _scan_for_malicious_patterns(self, content: bytes) -> List[str]:
        """Buscar patrones maliciosos en el contenido"""
        patterns = []
        
        # Patrones de inyección
        malicious_patterns = [
            rb'<\s*script[^>]*>.*?</\s*script\s*>',
            rb'javascript\s*:',
            rb'vbscript\s*:',
            rb'data\s*:\s*text\s*/\s*html',
            rb'eval\s*\(',
            rb'document\s*\.\s*write',
        ]
        
        content_lower = content.lower()
        
        for pattern in malicious_patterns:
            if re.search(pattern, content_lower, re.IGNORECASE | re.DOTALL):
                patterns.append(pattern.decode('utf-8', errors='ignore'))
        
        return patterns
    
    def _calculate_entropy(self, data: bytes) -> float:
        """Calcular entropía de Shannon del archivo"""
        if not data:
            return 0
        
        # Contar frecuencia de bytes
        byte_counts = [0] * 256
        for byte in data:
            byte_counts[byte] += 1
        
        # Calcular entropía
        entropy = 0
        data_len = len(data)
        
        for count in byte_counts:
            if count > 0:
                probability = count / data_len
                entropy -= probability * (probability.bit_length() - 1)
        
        return entropy


class FileSanitizer:
    """Sanitizador de archivos"""
    
    @staticmethod
    def sanitize_metadata(metadata: Dict) -> Dict:
        """Sanitizar metadatos de archivo"""
        safe_metadata = {}
        
        # Solo permitir campos seguros
        allowed_fields = {
            'title', 'description', 'author', 'created_date',
            'modified_date', 'version', 'software', 'units',
            'category', 'discipline', 'project_name'
        }
        
        for key, value in metadata.items():
            if key in allowed_fields and isinstance(value, (str, int, float)):
                # Sanitizar strings
                if isinstance(value, str):
                    safe_metadata[key] = re.sub(r'[<>"\']', '', str(value)[:500])
                else:
                    safe_metadata[key] = value
        
        return safe_metadata
    
    @staticmethod
    def generate_safe_object_name(filename: str, user_id: int) -> str:
        """Generar nombre seguro para objeto en APS"""
        import uuid
        
        # Limpiar filename
        name_part = Path(filename).stem
        extension = Path(filename).suffix
        
        # Remover caracteres especiales
        safe_name = re.sub(r'[^a-zA-Z0-9_-]', '_', name_part)
        
        # Limitar longitud
        if len(safe_name) > 50:
            safe_name = safe_name[:50]
        
        # Agregar timestamp y UUID para unicidad
        timestamp = int(time.time())
        unique_id = str(uuid.uuid4())[:8]
        
        return f"{user_id}_{timestamp}_{safe_name}_{unique_id}{extension}"


# Instancia global del validador
file_validator = FileValidator()
file_sanitizer = FileSanitizer()

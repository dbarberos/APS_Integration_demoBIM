"""
Servicio de APS Model Derivative API - Traducción de modelos CAD/BIM
"""
import asyncio
import time
import uuid
from typing import Dict, List, Optional, Any, Tuple, Union
from datetime import datetime, timedelta
import structlog
import httpx
from urllib.parse import quote

from app.services.aps_auth import APSAuthService
from app.services.urn_manager import urn_manager, URNValidationError
from app.core.config import settings

logger = structlog.get_logger()


class ModelDerivativeError(Exception):
    """Error de Model Derivative API"""
    pass


class TranslationTimeoutError(ModelDerivativeError):
    """Error de timeout en traducción"""
    pass


class ModelDerivativeService:
    """Servicio principal para APS Model Derivative API"""
    
    # Configuraciones por formato de archivo
    FORMAT_CONFIGS = {
        '.rvt': {
            'default_outputs': ['svf2', 'thumbnail'],
            'advanced_options': {
                'generateMasterViews': True,
                'buildingStoreys': True,
                'spaces': True,
                'materialProperties': True
            },
            'estimated_time': 300,  # 5 minutos
            'timeout': 1800  # 30 minutos
        },
        '.ifc': {
            'default_outputs': ['svf2', 'thumbnail'],
            'advanced_options': {
                'generateMasterViews': True,
                'materialProperties': True,
                'openingElements': True
            },
            'estimated_time': 240,  # 4 minutos
            'timeout': 1500  # 25 minutos
        },
        '.dwg': {
            'default_outputs': ['svf', 'thumbnail'],
            'advanced_options': {
                'generateMasterViews': False,
                '2dviews': True,
                'extractThumbnail': True
            },
            'estimated_time': 120,  # 2 minutos
            'timeout': 900  # 15 minutos
        },
        '.3dm': {
            'default_outputs': ['svf2', 'thumbnail'],
            'advanced_options': {
                'generateMasterViews': True,
                'materialProperties': True
            },
            'estimated_time': 180,  # 3 minutos
            'timeout': 1200  # 20 minutos
        },
        'default': {
            'default_outputs': ['svf2', 'thumbnail'],
            'advanced_options': {
                'generateMasterViews': True
            },
            'estimated_time': 300,
            'timeout': 1800
        }
    }
    
    # Configuraciones de calidad
    QUALITY_LEVELS = {
        'low': {
            'svf2': {'compressionLevel': 9, 'generateMasterViews': False},
            'thumbnail': {'width': 100, 'height': 100}
        },
        'medium': {
            'svf2': {'compressionLevel': 6, 'generateMasterViews': True},
            'thumbnail': {'width': 200, 'height': 200}
        },
        'high': {
            'svf2': {'compressionLevel': 3, 'generateMasterViews': True},
            'thumbnail': {'width': 400, 'height': 400}
        }
    }
    
    def __init__(self):
        self.auth_service = APSAuthService()
        self.base_url = "https://developer.api.autodesk.com/modelderivative/v2"
        self.client = None
        
    async def _get_client(self) -> httpx.AsyncClient:
        """Obtener cliente HTTP configurado"""
        if not self.client:
            # Obtener token de aplicación
            token = await self.auth_service.get_application_token()
            if not token:
                raise ModelDerivativeError("No se pudo obtener token de autenticación")
            
            # Configurar cliente
            self.client = httpx.AsyncClient(
                headers={
                    "Authorization": f"Bearer {token}",
                    "Content-Type": "application/json",
                    "x-ads-force": "true"  # Forzar procesamiento
                },
                timeout=30.0,
                limits=httpx.Limits(max_connections=10, max_keepalive_connections=5)
            )
        
        return self.client
    
    async def start_translation(
        self,
        source_urn: str,
        output_formats: List[str] = None,
        quality_level: str = "medium",
        custom_config: Dict = None,
        root_filename: str = None,
        compress_result: bool = True
    ) -> Dict[str, Any]:
        """
        Iniciar traducción de modelo
        
        Args:
            source_urn: URN del archivo fuente
            output_formats: Formatos de salida solicitados
            quality_level: Nivel de calidad (low, medium, high)
            custom_config: Configuración personalizada
            root_filename: Nombre del archivo raíz (para ZIP)
            compress_result: Comprimir resultado
            
        Returns:
            Diccionario con información del trabajo iniciado
        """
        try:
            logger.info("Iniciando traducción de modelo", 
                       source_urn=source_urn[:50] + "...",
                       output_formats=output_formats,
                       quality_level=quality_level)
            
            # Validar URN fuente
            urn_manager.validate_urn(source_urn)
            
            # Determinar configuración
            file_extension = self._get_file_extension_from_urn(source_urn)
            config = self._get_format_config(file_extension)
            
            # Determinar formatos de salida
            if not output_formats:
                output_formats = config['default_outputs']
            
            # Construir payload de traducción
            job_payload = self._build_translation_payload(
                source_urn=source_urn,
                output_formats=output_formats,
                quality_level=quality_level,
                config=config,
                custom_config=custom_config,
                root_filename=root_filename,
                compress_result=compress_result
            )
            
            # Realizar petición de traducción
            client = await self._get_client()
            response = await client.post(
                f"{self.base_url}/designdata/job",
                json=job_payload
            )
            
            if response.status_code == 200 or response.status_code == 201:
                result_data = response.json()
                
                # Extraer información del trabajo
                job_info = {
                    'job_id': result_data.get('urn'),  # URN del trabajo
                    'status': 'pending',
                    'progress': 0.0,
                    'source_urn': source_urn,
                    'output_formats': output_formats,
                    'quality_level': quality_level,
                    'estimated_duration': config['estimated_time'],
                    'timeout': config['timeout'],
                    'created_at': datetime.utcnow().isoformat(),
                    'payload': job_payload
                }
                
                logger.info("Traducción iniciada exitosamente", 
                           job_id=job_info['job_id'],
                           estimated_duration=config['estimated_time'])
                
                return job_info
                
            else:
                error_data = response.json() if response.content else {}
                error_msg = error_data.get('errorMessage', f'HTTP {response.status_code}')
                
                logger.error("Error iniciando traducción", 
                           status_code=response.status_code,
                           error=error_msg)
                
                raise ModelDerivativeError(f"Error iniciando traducción: {error_msg}")
                
        except ModelDerivativeError:
            raise
        except Exception as e:
            logger.error("Error inesperado iniciando traducción", error=str(e))
            raise ModelDerivativeError(f"Error inesperado: {e}")
    
    def _get_file_extension_from_urn(self, urn: str) -> str:
        """Extraer extensión de archivo del URN"""
        try:
            # Para URN de objeto: urn:adsk.objects:os.object:bucket/filename.ext
            if 'objects:os.object:' in urn:
                _, object_key = urn_manager.extract_bucket_and_object(urn)
                if '.' in object_key:
                    return '.' + object_key.split('.')[-1].lower()
            
            return 'default'
            
        except Exception:
            logger.warning("No se pudo extraer extensión del URN", urn=urn[:50] + "...")
            return 'default'
    
    def _get_format_config(self, file_extension: str) -> Dict:
        """Obtener configuración para formato de archivo"""
        return self.FORMAT_CONFIGS.get(file_extension, self.FORMAT_CONFIGS['default'])
    
    def _build_translation_payload(
        self,
        source_urn: str,
        output_formats: List[str],
        quality_level: str,
        config: Dict,
        custom_config: Dict = None,
        root_filename: str = None,
        compress_result: bool = True
    ) -> Dict[str, Any]:
        """Construir payload para petición de traducción"""
        
        # Base del payload
        payload = {
            "input": {
                "urn": urn_manager.encode_urn(source_urn),
                "compressedUrn": compress_result
            },
            "output": {
                "formats": []
            }
        }
        
        # Agregar root filename si se proporciona
        if root_filename:
            payload["input"]["rootFilename"] = root_filename
        
        # Configuración de calidad
        quality_config = self.QUALITY_LEVELS.get(quality_level, self.QUALITY_LEVELS['medium'])
        
        # Construir formatos de salida
        for format_type in output_formats:
            format_config = self._build_format_config(
                format_type, 
                quality_config,
                config,
                custom_config
            )
            payload["output"]["formats"].append(format_config)
        
        return payload
    
    def _build_format_config(
        self,
        format_type: str,
        quality_config: Dict,
        base_config: Dict,
        custom_config: Dict = None
    ) -> Dict[str, Any]:
        """Construir configuración para formato específico"""
        
        format_config = {
            "type": format_type
        }
        
        # Configuración específica por tipo
        if format_type == "svf2":
            format_config.update({
                "views": ["2d", "3d"],
                "advanced": {
                    **base_config.get('advanced_options', {}),
                    **quality_config.get('svf2', {}),
                    "modelGuid": str(uuid.uuid4()),
                    "objectIds": "-1"  # Todos los objetos
                }
            })
            
        elif format_type == "svf":
            format_config.update({
                "views": ["2d", "3d"],
                "advanced": {
                    **base_config.get('advanced_options', {}),
                    "modelGuid": str(uuid.uuid4())
                }
            })
            
        elif format_type == "thumbnail":
            thumbnail_config = quality_config.get('thumbnail', {'width': 200, 'height': 200})
            format_config.update({
                "advanced": thumbnail_config
            })
            
        elif format_type in ["stl", "step", "iges", "obj"]:
            format_config.update({
                "advanced": {
                    "format": format_type.upper(),
                    "exportFileStructure": "single"
                }
            })
            
        elif format_type == "gltf":
            format_config.update({
                "advanced": {
                    "exportFileStructure": "single",
                    "modelGuid": str(uuid.uuid4())
                }
            })
        
        # Aplicar configuración personalizada
        if custom_config and format_type in custom_config:
            self._merge_config(format_config, custom_config[format_type])
        
        return format_config
    
    def _merge_config(self, base_config: Dict, custom_config: Dict):
        """Fusionar configuración personalizada"""
        for key, value in custom_config.items():
            if key == "advanced" and "advanced" in base_config:
                base_config["advanced"].update(value)
            else:
                base_config[key] = value
    
    async def get_translation_status(self, job_urn: str) -> Dict[str, Any]:
        """
        Obtener estado de traducción
        
        Args:
            job_urn: URN del trabajo de traducción
            
        Returns:
            Diccionario con estado actual
        """
        try:
            logger.debug("Consultando estado de traducción", job_urn=job_urn[:50] + "...")
            
            # Validar URN del trabajo
            urn_manager.validate_urn(job_urn)
            encoded_urn = urn_manager.encode_urn(job_urn)
            
            # Consultar estado
            client = await self._get_client()
            response = await client.get(f"{self.base_url}/designdata/{encoded_urn}/manifest")
            
            if response.status_code == 200:
                manifest_data = response.json()
                
                # Parsear estado
                status_info = self._parse_manifest_status(manifest_data)
                status_info['job_urn'] = job_urn
                status_info['last_checked'] = datetime.utcnow().isoformat()
                
                logger.debug("Estado de traducción obtenido", 
                           status=status_info.get('status'),
                           progress=status_info.get('progress'))
                
                return status_info
                
            elif response.status_code == 202:
                # Traducción aún en progreso
                return {
                    'job_urn': job_urn,
                    'status': 'inprogress',
                    'progress': 50.0,  # Estimación
                    'message': 'Traducción en progreso',
                    'last_checked': datetime.utcnow().isoformat()
                }
                
            elif response.status_code == 404:
                logger.warning("Trabajo de traducción no encontrado", job_urn=job_urn[:50] + "...")
                return {
                    'job_urn': job_urn,
                    'status': 'failed',
                    'progress': 0.0,
                    'error': 'Trabajo no encontrado',
                    'last_checked': datetime.utcnow().isoformat()
                }
                
            else:
                error_data = response.json() if response.content else {}
                error_msg = error_data.get('errorMessage', f'HTTP {response.status_code}')
                
                logger.error("Error consultando estado", 
                           status_code=response.status_code,
                           error=error_msg)
                
                return {
                    'job_urn': job_urn,
                    'status': 'failed',
                    'progress': 0.0,
                    'error': error_msg,
                    'last_checked': datetime.utcnow().isoformat()
                }
                
        except Exception as e:
            logger.error("Error consultando estado de traducción", error=str(e))
            return {
                'job_urn': job_urn,
                'status': 'failed',
                'progress': 0.0,
                'error': str(e),
                'last_checked': datetime.utcnow().isoformat()
            }
    
    def _parse_manifest_status(self, manifest_data: Dict) -> Dict[str, Any]:
        """Parsear estado desde manifest"""
        status_info = {
            'status': 'unknown',
            'progress': 0.0,
            'message': '',
            'derivatives': [],
            'warnings': [],
            'metadata': {}
        }
        
        # Estado general
        overall_status = manifest_data.get('status', 'unknown').lower()
        
        if overall_status == 'success':
            status_info['status'] = 'success'
            status_info['progress'] = 100.0
            status_info['message'] = 'Traducción completada exitosamente'
            
        elif overall_status == 'inprogress':
            status_info['status'] = 'inprogress'
            status_info['progress'] = manifest_data.get('progress', '50%')
            
            # Convertir progreso a número si es string
            if isinstance(status_info['progress'], str):
                try:
                    status_info['progress'] = float(status_info['progress'].replace('%', ''))
                except:
                    status_info['progress'] = 50.0
                    
            status_info['message'] = 'Traducción en progreso'
            
        elif overall_status == 'failed':
            status_info['status'] = 'failed'
            status_info['progress'] = 0.0
            status_info['message'] = 'Traducción falló'
            
        elif overall_status == 'timeout':
            status_info['status'] = 'timeout'
            status_info['progress'] = 0.0
            status_info['message'] = 'Traducción expiró'
        
        # Procesar derivatives
        derivatives = manifest_data.get('derivatives', [])
        for derivative in derivatives:
            derivative_info = {
                'name': derivative.get('name', ''),
                'status': derivative.get('status', 'unknown'),
                'progress': derivative.get('progress', '0%'),
                'outputType': derivative.get('outputType', ''),
                'children': derivative.get('children', [])
            }
            
            # Procesar advertencias
            if 'messages' in derivative:
                for message in derivative['messages']:
                    if message.get('type') == 'warning':
                        status_info['warnings'].append(message.get('message', ''))
            
            status_info['derivatives'].append(derivative_info)
        
        # Extraer metadatos útiles
        status_info['metadata'] = {
            'type': manifest_data.get('type', ''),
            'region': manifest_data.get('region', ''),
            'version': manifest_data.get('version', ''),
            'thumbnails': manifest_data.get('thumbnails', [])
        }
        
        return status_info
    
    async def get_manifest(self, job_urn: str) -> Dict[str, Any]:
        """
        Obtener manifest completo del modelo
        
        Args:
            job_urn: URN del trabajo
            
        Returns:
            Manifest completo
        """
        try:
            logger.debug("Obteniendo manifest", job_urn=job_urn[:50] + "...")
            
            urn_manager.validate_urn(job_urn)
            encoded_urn = urn_manager.encode_urn(job_urn)
            
            client = await self._get_client()
            response = await client.get(f"{self.base_url}/designdata/{encoded_urn}/manifest")
            
            if response.status_code == 200:
                manifest = response.json()
                logger.debug("Manifest obtenido exitosamente")
                return manifest
            else:
                error_data = response.json() if response.content else {}
                error_msg = error_data.get('errorMessage', f'HTTP {response.status_code}')
                raise ModelDerivativeError(f"Error obteniendo manifest: {error_msg}")
                
        except ModelDerivativeError:
            raise
        except Exception as e:
            logger.error("Error obteniendo manifest", error=str(e))
            raise ModelDerivativeError(f"Error inesperado obteniendo manifest: {e}")
    
    async def get_metadata(self, job_urn: str, model_guid: str = None) -> Dict[str, Any]:
        """
        Obtener metadatos del modelo
        
        Args:
            job_urn: URN del trabajo
            model_guid: GUID del modelo específico
            
        Returns:
            Metadatos del modelo
        """
        try:
            logger.debug("Obteniendo metadatos", job_urn=job_urn[:50] + "...")
            
            urn_manager.validate_urn(job_urn)
            encoded_urn = urn_manager.encode_urn(job_urn)
            
            # Si no se proporciona model_guid, obtenerlo del manifest
            if not model_guid:
                manifest = await self.get_manifest(job_urn)
                model_guid = self._extract_model_guid(manifest)
            
            if not model_guid:
                raise ModelDerivativeError("No se pudo encontrar GUID del modelo")
            
            client = await self._get_client()
            response = await client.get(
                f"{self.base_url}/designdata/{encoded_urn}/metadata/{model_guid}"
            )
            
            if response.status_code == 200:
                metadata = response.json()
                logger.debug("Metadatos obtenidos exitosamente")
                return metadata
            else:
                error_data = response.json() if response.content else {}
                error_msg = error_data.get('errorMessage', f'HTTP {response.status_code}')
                raise ModelDerivativeError(f"Error obteniendo metadatos: {error_msg}")
                
        except ModelDerivativeError:
            raise
        except Exception as e:
            logger.error("Error obteniendo metadatos", error=str(e))
            raise ModelDerivativeError(f"Error inesperado obteniendo metadatos: {e}")
    
    def _extract_model_guid(self, manifest: Dict) -> Optional[str]:
        """Extraer GUID del modelo desde manifest"""
        try:
            derivatives = manifest.get('derivatives', [])
            for derivative in derivatives:
                if derivative.get('outputType') in ['svf', 'svf2']:
                    children = derivative.get('children', [])
                    for child in children:
                        if child.get('type') == 'resource' and child.get('role') == 'graphics':
                            guid = child.get('guid')
                            if guid:
                                return guid
            return None
        except Exception:
            return None
    
    async def get_object_tree(self, job_urn: str, model_guid: str = None) -> Dict[str, Any]:
        """
        Obtener árbol de objetos del modelo
        
        Args:
            job_urn: URN del trabajo
            model_guid: GUID del modelo
            
        Returns:
            Árbol de objetos
        """
        try:
            logger.debug("Obteniendo árbol de objetos", job_urn=job_urn[:50] + "...")
            
            urn_manager.validate_urn(job_urn)
            encoded_urn = urn_manager.encode_urn(job_urn)
            
            if not model_guid:
                manifest = await self.get_manifest(job_urn)
                model_guid = self._extract_model_guid(manifest)
            
            if not model_guid:
                raise ModelDerivativeError("No se pudo encontrar GUID del modelo")
            
            client = await self._get_client()
            response = await client.get(
                f"{self.base_url}/designdata/{encoded_urn}/metadata/{model_guid}"
            )
            
            if response.status_code == 200:
                tree_data = response.json()
                logger.debug("Árbol de objetos obtenido exitosamente")
                return tree_data
            else:
                error_data = response.json() if response.content else {}
                error_msg = error_data.get('errorMessage', f'HTTP {response.status_code}')
                raise ModelDerivativeError(f"Error obteniendo árbol de objetos: {error_msg}")
                
        except ModelDerivativeError:
            raise
        except Exception as e:
            logger.error("Error obteniendo árbol de objetos", error=str(e))
            raise ModelDerivativeError(f"Error inesperado: {e}")
    
    async def delete_manifest(self, job_urn: str) -> bool:
        """
        Eliminar manifest y derivatives
        
        Args:
            job_urn: URN del trabajo
            
        Returns:
            True si se eliminó exitosamente
        """
        try:
            logger.info("Eliminando manifest", job_urn=job_urn[:50] + "...")
            
            urn_manager.validate_urn(job_urn)
            encoded_urn = urn_manager.encode_urn(job_urn)
            
            client = await self._get_client()
            response = await client.delete(f"{self.base_url}/designdata/{encoded_urn}/manifest")
            
            if response.status_code in [200, 202, 204]:
                logger.info("Manifest eliminado exitosamente")
                return True
            else:
                error_data = response.json() if response.content else {}
                error_msg = error_data.get('errorMessage', f'HTTP {response.status_code}')
                logger.error("Error eliminando manifest", error=error_msg)
                return False
                
        except Exception as e:
            logger.error("Error eliminando manifest", error=str(e))
            return False
    
    async def check_supported_formats(self) -> Dict[str, List[str]]:
        """
        Verificar formatos soportados
        
        Returns:
            Diccionario con formatos de entrada y salida soportados
        """
        try:
            client = await self._get_client()
            response = await client.get(f"{self.base_url}/designdata/formats")
            
            if response.status_code == 200:
                formats_data = response.json()
                return {
                    'input_formats': formats_data.get('formats', {}).get('input', []),
                    'output_formats': formats_data.get('formats', {}).get('output', [])
                }
            else:
                logger.warning("No se pudieron obtener formatos soportados")
                return {'input_formats': [], 'output_formats': []}
                
        except Exception as e:
            logger.error("Error obteniendo formatos soportados", error=str(e))
            return {'input_formats': [], 'output_formats': []}
    
    async def close(self):
        """Cerrar cliente HTTP"""
        if self.client:
            await self.client.aclose()
            self.client = None


# Instancia global del servicio
model_derivative_service = ModelDerivativeService()

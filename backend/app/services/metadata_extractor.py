"""
Extractor de metadatos completos de modelos CAD/BIM
"""
import asyncio
from typing import Dict, List, Optional, Any, Set, Tuple
from datetime import datetime
import structlog
import httpx
from collections import defaultdict, Counter

from app.services.aps_auth import APSAuthService
from app.services.urn_manager import urn_manager
from app.core.config import settings

logger = structlog.get_logger()


class MetadataExtractionError(Exception):
    """Error de extracción de metadatos"""
    pass


class MetadataExtractor:
    """Extractor completo de metadatos de modelos"""
    
    # Mapeo de disciplinas por categorías
    DISCIPLINE_MAPPING = {
        'Walls': 'Architecture',
        'Doors': 'Architecture', 
        'Windows': 'Architecture',
        'Floors': 'Architecture',
        'Roofs': 'Architecture',
        'Ceilings': 'Architecture',
        'Stairs': 'Architecture',
        'Railings': 'Architecture',
        'Columns': 'Structure',
        'Beams': 'Structure',
        'Foundations': 'Structure',
        'Structural Framing': 'Structure',
        'Rebar': 'Structure',
        'Duct Systems': 'MEP',
        'Pipe Systems': 'MEP',
        'Cable Trays': 'MEP',
        'Conduits': 'MEP',
        'Lighting Fixtures': 'MEP',
        'Electrical Equipment': 'MEP',
        'Mechanical Equipment': 'MEP',
        'Plumbing Fixtures': 'MEP',
        'Fire Protection': 'MEP',
        'HVAC': 'MEP',
        'Roads': 'Civil',
        'Site': 'Civil',
        'Topography': 'Civil',
        'Generic Models': 'Generic'
    }
    
    # Propiedades importantes por disciplina
    IMPORTANT_PROPERTIES = {
        'Architecture': [
            'Area', 'Volume', 'Height', 'Width', 'Length', 'Thickness',
            'Material', 'Fire Rating', 'Acoustic Rating', 'Thermal Properties'
        ],
        'Structure': [
            'Material', 'Cross Section', 'Length', 'Area', 'Moment of Inertia',
            'Yield Strength', 'Ultimate Strength', 'Elastic Modulus', 'Load Capacity'
        ],
        'MEP': [
            'Flow', 'Pressure', 'Temperature', 'Voltage', 'Current', 'Power',
            'Efficiency', 'Capacity', 'Size', 'Connection Type', 'System Type'
        ],
        'Civil': [
            'Slope', 'Elevation', 'Material', 'Thickness', 'Width', 'Station',
            'Offset', 'Gradient', 'Surface Area'
        ]
    }
    
    def __init__(self):
        self.auth_service = APSAuthService()
        self.base_url = "https://developer.api.autodesk.com/modelderivative/v2"
        self.client = None
    
    async def _get_client(self) -> httpx.AsyncClient:
        """Obtener cliente HTTP configurado"""
        if not self.client:
            token = await self.auth_service.get_application_token()
            if not token:
                raise MetadataExtractionError("No se pudo obtener token de autenticación")
            
            self.client = httpx.AsyncClient(
                headers={
                    "Authorization": f"Bearer {token}",
                    "Content-Type": "application/json"
                },
                timeout=60.0
            )
        
        return self.client
    
    async def extract_comprehensive_metadata(
        self, 
        source_urn: str, 
        manifest: Dict = None
    ) -> Dict[str, Any]:
        """
        Extraer metadatos completos del modelo
        
        Args:
            source_urn: URN del modelo fuente
            manifest: Manifest del modelo (opcional)
            
        Returns:
            Diccionario con metadatos completos
        """
        try:
            logger.info("Iniciando extracción completa de metadatos", 
                       source_urn=source_urn[:50] + "...")
            
            # Validar URN
            urn_manager.validate_urn(source_urn)
            
            # Obtener manifest si no se proporciona
            if not manifest:
                manifest = await self._get_manifest(source_urn)
            
            # Extraer modelo GUID
            model_guid = self._extract_model_guid(manifest)
            if not model_guid:
                raise MetadataExtractionError("No se pudo encontrar GUID del modelo")
            
            # Extraer metadatos en paralelo
            metadata_tasks = [
                self._extract_model_metadata(source_urn, model_guid),
                self._extract_object_tree(source_urn, model_guid),
                self._extract_properties_bulk(source_urn, model_guid),
                self._extract_geometry_metadata(manifest),
                self._extract_material_metadata(source_urn, model_guid),
                self._extract_units_metadata(source_urn, model_guid)
            ]
            
            results = await asyncio.gather(*metadata_tasks, return_exceptions=True)
            
            # Procesar resultados
            model_metadata = results[0] if not isinstance(results[0], Exception) else {}
            object_tree = results[1] if not isinstance(results[1], Exception) else {}
            properties_bulk = results[2] if not isinstance(results[2], Exception) else {}
            geometry_metadata = results[3] if not isinstance(results[3], Exception) else {}
            material_metadata = results[4] if not isinstance(results[4], Exception) else {}
            units_metadata = results[5] if not isinstance(results[5], Exception) else {}
            
            # Compilar metadatos completos
            comprehensive_metadata = self._compile_comprehensive_metadata(
                model_metadata=model_metadata,
                object_tree=object_tree,
                properties_bulk=properties_bulk,
                geometry_metadata=geometry_metadata,
                material_metadata=material_metadata,
                units_metadata=units_metadata,
                manifest=manifest
            )
            
            logger.info("Extracción de metadatos completada", 
                       element_count=comprehensive_metadata.get('element_count', 0),
                       categories=len(comprehensive_metadata.get('categories', [])))
            
            return comprehensive_metadata
            
        except Exception as e:
            logger.error("Error en extracción de metadatos", error=str(e))
            raise MetadataExtractionError(f"Error extrayendo metadatos: {e}")
    
    async def _get_manifest(self, source_urn: str) -> Dict:
        """Obtener manifest del modelo"""
        try:
            encoded_urn = urn_manager.encode_urn(source_urn)
            client = await self._get_client()
            
            response = await client.get(f"{self.base_url}/designdata/{encoded_urn}/manifest")
            
            if response.status_code == 200:
                return response.json()
            else:
                raise MetadataExtractionError(f"Error obteniendo manifest: HTTP {response.status_code}")
                
        except Exception as e:
            logger.error("Error obteniendo manifest", error=str(e))
            raise
    
    def _extract_model_guid(self, manifest: Dict) -> Optional[str]:
        """Extraer GUID del modelo desde manifest"""
        try:
            derivatives = manifest.get('derivatives', [])
            for derivative in derivatives:
                if derivative.get('outputType') in ['svf', 'svf2']:
                    children = derivative.get('children', [])
                    for child in children:
                        if child.get('type') == 'resource' and child.get('role') == 'graphics':
                            return child.get('guid')
            return None
        except Exception:
            return None
    
    async def _extract_model_metadata(self, source_urn: str, model_guid: str) -> Dict:
        """Extraer metadatos básicos del modelo"""
        try:
            encoded_urn = urn_manager.encode_urn(source_urn)
            client = await self._get_client()
            
            response = await client.get(
                f"{self.base_url}/designdata/{encoded_urn}/metadata/{model_guid}"
            )
            
            if response.status_code == 200:
                return response.json()
            else:
                logger.warning("No se pudieron obtener metadatos del modelo")
                return {}
                
        except Exception as e:
            logger.warning("Error obteniendo metadatos del modelo", error=str(e))
            return {}
    
    async def _extract_object_tree(self, source_urn: str, model_guid: str) -> Dict:
        """Extraer árbol de objetos del modelo"""
        try:
            encoded_urn = urn_manager.encode_urn(source_urn)
            client = await self._get_client()
            
            response = await client.get(
                f"{self.base_url}/designdata/{encoded_urn}/metadata/{model_guid}"
            )
            
            if response.status_code == 200:
                return response.json()
            else:
                logger.warning("No se pudo obtener árbol de objetos")
                return {}
                
        except Exception as e:
            logger.warning("Error obteniendo árbol de objetos", error=str(e))
            return {}
    
    async def _extract_properties_bulk(self, source_urn: str, model_guid: str) -> Dict:
        """Extraer propiedades de todos los objetos (bulk)"""
        try:
            encoded_urn = urn_manager.encode_urn(source_urn)
            client = await self._get_client()
            
            # Obtener propiedades en bulk
            response = await client.get(
                f"{self.base_url}/designdata/{encoded_urn}/metadata/{model_guid}/properties"
            )
            
            if response.status_code == 200:
                return response.json()
            else:
                logger.warning("No se pudieron obtener propiedades en bulk")
                return {}
                
        except Exception as e:
            logger.warning("Error obteniendo propiedades en bulk", error=str(e))
            return {}
    
    async def _extract_geometry_metadata(self, manifest: Dict) -> Dict:
        """Extraer metadatos de geometría desde manifest"""
        try:
            geometry_info = {
                'has_geometry': False,
                'geometry_types': [],
                'file_size_bytes': 0,
                'compression_used': False,
                'lod_levels': []
            }
            
            derivatives = manifest.get('derivatives', [])
            for derivative in derivatives:
                if derivative.get('outputType') in ['svf', 'svf2']:
                    geometry_info['has_geometry'] = True
                    geometry_info['geometry_types'].append(derivative.get('outputType'))
                    
                    # Analizar hijos para más detalles
                    children = derivative.get('children', [])
                    for child in children:
                        if child.get('type') == 'resource':
                            file_size = child.get('size', 0)
                            if isinstance(file_size, (int, float)):
                                geometry_info['file_size_bytes'] += file_size
                            
                            # Detectar compresión
                            if child.get('compression') or 'compress' in child.get('mime', ''):
                                geometry_info['compression_used'] = True
            
            return geometry_info
            
        except Exception as e:
            logger.warning("Error extrayendo metadatos de geometría", error=str(e))
            return {}
    
    async def _extract_material_metadata(self, source_urn: str, model_guid: str) -> Dict:
        """Extraer información de materiales"""
        try:
            # Esta función requeriría acceso específico a propiedades de materiales
            # Por ahora retornamos estructura básica
            material_info = {
                'materials': [],
                'material_count': 0,
                'has_textures': False,
                'has_physical_properties': False
            }
            
            # TODO: Implementar extracción real de materiales cuando esté disponible en API
            return material_info
            
        except Exception as e:
            logger.warning("Error extrayendo metadatos de materiales", error=str(e))
            return {}
    
    async def _extract_units_metadata(self, source_urn: str, model_guid: str) -> Dict:
        """Extraer información de unidades del modelo"""
        try:
            units_info = {
                'length_unit': 'unknown',
                'area_unit': 'unknown',
                'volume_unit': 'unknown',
                'angle_unit': 'unknown',
                'coordinate_system': 'unknown'
            }
            
            # TODO: Implementar extracción real de unidades
            return units_info
            
        except Exception as e:
            logger.warning("Error extrayendo metadatos de unidades", error=str(e))
            return {}
    
    def _compile_comprehensive_metadata(
        self,
        model_metadata: Dict,
        object_tree: Dict,
        properties_bulk: Dict,
        geometry_metadata: Dict,
        material_metadata: Dict,
        units_metadata: Dict,
        manifest: Dict
    ) -> Dict[str, Any]:
        """Compilar todos los metadatos en estructura unificada"""
        
        # Estructura base
        comprehensive = {
            'extraction_timestamp': datetime.utcnow().isoformat(),
            'source_info': self._extract_source_info(manifest),
            'model_info': self._extract_model_info(model_metadata),
            'geometry_info': geometry_metadata,
            'material_info': material_metadata,
            'units_info': units_metadata,
            'hierarchy_info': self._analyze_hierarchy(object_tree),
            'categories_analysis': self._analyze_categories(properties_bulk),
            'discipline_analysis': self._analyze_disciplines(properties_bulk),
            'properties_summary': self._summarize_properties(properties_bulk),
            'quality_metrics': self._calculate_quality_metrics(
                model_metadata, object_tree, properties_bulk, geometry_metadata
            ),
            'statistics': self._calculate_statistics(object_tree, properties_bulk),
            'recommendations': self._generate_recommendations(
                geometry_metadata, material_metadata, properties_bulk
            )
        }
        
        return comprehensive
    
    def _extract_source_info(self, manifest: Dict) -> Dict:
        """Extraer información del archivo fuente"""
        return {
            'type': manifest.get('type', 'unknown'),
            'region': manifest.get('region', 'unknown'),
            'version': manifest.get('version', 'unknown'),
            'status': manifest.get('status', 'unknown'),
            'progress': manifest.get('progress', '0%'),
            'derivatives_count': len(manifest.get('derivatives', []))
        }
    
    def _extract_model_info(self, model_metadata: Dict) -> Dict:
        """Extraer información básica del modelo"""
        metadata = model_metadata.get('data', {}).get('metadata', [])
        
        info = {
            'name': '',
            'created_by': '',
            'created_date': '',
            'modified_date': '',
            'application': '',
            'version': '',
            'file_size': 0
        }
        
        # Parsear metadatos
        for item in metadata:
            name = item.get('name', '').lower()
            value = item.get('value', '')
            
            if 'name' in name or 'title' in name:
                info['name'] = value
            elif 'author' in name or 'creator' in name:
                info['created_by'] = value
            elif 'created' in name or 'date' in name:
                info['created_date'] = value
            elif 'modified' in name or 'updated' in name:
                info['modified_date'] = value
            elif 'application' in name or 'software' in name:
                info['application'] = value
            elif 'version' in name:
                info['version'] = value
            elif 'size' in name:
                try:
                    info['file_size'] = int(value)
                except:
                    pass
        
        return info
    
    def _analyze_hierarchy(self, object_tree: Dict) -> Dict:
        """Analizar jerarquía del modelo"""
        hierarchy_info = {
            'total_nodes': 0,
            'max_depth': 0,
            'leaf_nodes': 0,
            'intermediate_nodes': 0,
            'root_nodes': 0
        }
        
        def traverse_tree(node, depth=0):
            hierarchy_info['total_nodes'] += 1
            hierarchy_info['max_depth'] = max(hierarchy_info['max_depth'], depth)
            
            children = node.get('objects', [])
            if not children:
                hierarchy_info['leaf_nodes'] += 1
            elif depth == 0:
                hierarchy_info['root_nodes'] += 1
            else:
                hierarchy_info['intermediate_nodes'] += 1
            
            for child in children:
                traverse_tree(child, depth + 1)
        
        # Procesar árbol
        data = object_tree.get('data', {})
        if 'objects' in data:
            for root_object in data['objects']:
                traverse_tree(root_object)
        
        return hierarchy_info
    
    def _analyze_categories(self, properties_bulk: Dict) -> Dict:
        """Analizar categorías de elementos"""
        categories = defaultdict(int)
        category_properties = defaultdict(set)
        
        # Procesar propiedades bulk
        collection = properties_bulk.get('data', {}).get('collection', [])
        
        for item in collection:
            properties = item.get('properties', {})
            
            # Buscar categoría en propiedades
            category = self._extract_category(properties)
            if category:
                categories[category] += 1
                
                # Recopilar propiedades por categoría
                for prop_group in properties.values():
                    if isinstance(prop_group, dict):
                        for prop_name in prop_group.keys():
                            category_properties[category].add(prop_name)
        
        return {
            'categories': dict(categories),
            'category_count': len(categories),
            'largest_category': max(categories.items(), key=lambda x: x[1]) if categories else None,
            'category_properties': {k: list(v) for k, v in category_properties.items()}
        }
    
    def _extract_category(self, properties: Dict) -> Optional[str]:
        """Extraer categoría del elemento desde propiedades"""
        # Buscar en diferentes grupos de propiedades
        for group_name, group_props in properties.items():
            if isinstance(group_props, dict):
                for prop_name, prop_value in group_props.items():
                    if 'category' in prop_name.lower():
                        return str(prop_value)
                    elif 'family' in prop_name.lower() and 'family' in group_name.lower():
                        return str(prop_value)
        
        return None
    
    def _analyze_disciplines(self, properties_bulk: Dict) -> Dict:
        """Analizar disciplinas del modelo"""
        discipline_count = defaultdict(int)
        category_to_discipline = {}
        
        # Procesar elementos y mapear a disciplinas
        collection = properties_bulk.get('data', {}).get('collection', [])
        
        for item in collection:
            properties = item.get('properties', {})
            category = self._extract_category(properties)
            
            if category:
                # Mapear categoría a disciplina
                discipline = self._map_category_to_discipline(category)
                discipline_count[discipline] += 1
                category_to_discipline[category] = discipline
        
        return {
            'disciplines': dict(discipline_count),
            'primary_discipline': max(discipline_count.items(), key=lambda x: x[1])[0] if discipline_count else 'Unknown',
            'discipline_count': len(discipline_count),
            'category_mapping': category_to_discipline
        }
    
    def _map_category_to_discipline(self, category: str) -> str:
        """Mapear categoría a disciplina"""
        category_lower = category.lower()
        
        for key, discipline in self.DISCIPLINE_MAPPING.items():
            if key.lower() in category_lower:
                return discipline
        
        return 'Generic'
    
    def _summarize_properties(self, properties_bulk: Dict) -> Dict:
        """Resumir propiedades del modelo"""
        property_summary = {
            'total_properties': 0,
            'common_properties': [],
            'property_types': defaultdict(int),
            'numeric_properties': [],
            'text_properties': []
        }
        
        all_properties = defaultdict(int)
        property_values = defaultdict(list)
        
        # Procesar todas las propiedades
        collection = properties_bulk.get('data', {}).get('collection', [])
        
        for item in collection:
            properties = item.get('properties', {})
            
            for group_name, group_props in properties.items():
                if isinstance(group_props, dict):
                    for prop_name, prop_value in group_props.items():
                        all_properties[prop_name] += 1
                        property_values[prop_name].append(prop_value)
                        property_summary['total_properties'] += 1
                        
                        # Clasificar tipo de propiedad
                        if isinstance(prop_value, (int, float)):
                            property_summary['property_types']['numeric'] += 1
                            if prop_name not in property_summary['numeric_properties']:
                                property_summary['numeric_properties'].append(prop_name)
                        elif isinstance(prop_value, str):
                            property_summary['property_types']['text'] += 1
                            if prop_name not in property_summary['text_properties']:
                                property_summary['text_properties'].append(prop_name)
        
        # Encontrar propiedades más comunes
        common_threshold = max(1, len(collection) * 0.5)  # 50% de elementos
        property_summary['common_properties'] = [
            prop for prop, count in all_properties.items() 
            if count >= common_threshold
        ]
        
        return property_summary
    
    def _calculate_quality_metrics(
        self, 
        model_metadata: Dict, 
        object_tree: Dict, 
        properties_bulk: Dict, 
        geometry_metadata: Dict
    ) -> Dict:
        """Calcular métricas de calidad del modelo"""
        
        metrics = {
            'completeness_score': 0.0,
            'consistency_score': 0.0,
            'detail_level_score': 0.0,
            'organization_score': 0.0,
            'overall_quality_score': 0.0
        }
        
        # Puntuación de completitud
        completeness_factors = 0
        if model_metadata.get('data', {}).get('metadata'):
            completeness_factors += 0.25
        if geometry_metadata.get('has_geometry'):
            completeness_factors += 0.25
        if properties_bulk.get('data', {}).get('collection'):
            completeness_factors += 0.25
        if object_tree.get('data', {}).get('objects'):
            completeness_factors += 0.25
        
        metrics['completeness_score'] = completeness_factors
        
        # Puntuación de nivel de detalle
        element_count = len(properties_bulk.get('data', {}).get('collection', []))
        if element_count > 0:
            # Normalizar usando escala logarítmica
            import math
            metrics['detail_level_score'] = min(1.0, math.log10(element_count) / 4.0)  # log10(10000) = 4
        
        # Puntuación de organización (basada en jerarquía)
        hierarchy = self._analyze_hierarchy(object_tree)
        if hierarchy['total_nodes'] > 0:
            # Mejor organización = más jerarquía
            depth_score = min(1.0, hierarchy['max_depth'] / 10.0)
            balance_score = 1.0 - abs(hierarchy['leaf_nodes'] - hierarchy['intermediate_nodes']) / hierarchy['total_nodes']
            metrics['organization_score'] = (depth_score + balance_score) / 2.0
        
        # Puntuación de consistencia (propiedades completas)
        collection = properties_bulk.get('data', {}).get('collection', [])
        if collection:
            property_completeness = []
            for item in collection:
                properties = item.get('properties', {})
                prop_count = sum(len(group) for group in properties.values() if isinstance(group, dict))
                property_completeness.append(prop_count)
            
            if property_completeness:
                avg_props = sum(property_completeness) / len(property_completeness)
                consistency = 1.0 - (max(property_completeness) - min(property_completeness)) / max(1, avg_props)
                metrics['consistency_score'] = max(0.0, consistency)
        
        # Puntuación general
        metrics['overall_quality_score'] = (
            metrics['completeness_score'] * 0.3 +
            metrics['detail_level_score'] * 0.3 +
            metrics['organization_score'] * 0.2 +
            metrics['consistency_score'] * 0.2
        )
        
        return metrics
    
    def _calculate_statistics(self, object_tree: Dict, properties_bulk: Dict) -> Dict:
        """Calcular estadísticas del modelo"""
        
        stats = {
            'element_count': 0,
            'property_count': 0,
            'avg_properties_per_element': 0.0,
            'unique_categories': 0,
            'file_complexity_score': 0.0
        }
        
        # Contar elementos
        collection = properties_bulk.get('data', {}).get('collection', [])
        stats['element_count'] = len(collection)
        
        # Contar propiedades y categorías
        categories = set()
        total_properties = 0
        
        for item in collection:
            properties = item.get('properties', {})
            
            for group_name, group_props in properties.items():
                if isinstance(group_props, dict):
                    total_properties += len(group_props)
                    
                    # Extraer categoría
                    category = self._extract_category(properties)
                    if category:
                        categories.add(category)
        
        stats['property_count'] = total_properties
        stats['unique_categories'] = len(categories)
        
        if stats['element_count'] > 0:
            stats['avg_properties_per_element'] = total_properties / stats['element_count']
        
        # Calcular complejidad
        hierarchy = self._analyze_hierarchy(object_tree)
        complexity_factors = [
            min(1.0, stats['element_count'] / 1000.0),  # Normalizar elementos
            min(1.0, hierarchy['max_depth'] / 10.0),    # Normalizar profundidad
            min(1.0, len(categories) / 20.0),           # Normalizar categorías
            min(1.0, stats['avg_properties_per_element'] / 50.0)  # Normalizar propiedades
        ]
        
        stats['file_complexity_score'] = sum(complexity_factors) / len(complexity_factors)
        
        return stats
    
    def _generate_recommendations(
        self, 
        geometry_metadata: Dict, 
        material_metadata: Dict, 
        properties_bulk: Dict
    ) -> List[str]:
        """Generar recomendaciones para el modelo"""
        
        recommendations = []
        
        # Analizar geometría
        if not geometry_metadata.get('has_geometry'):
            recommendations.append("El modelo no contiene geometría 3D visualizable")
        elif not geometry_metadata.get('compression_used'):
            recommendations.append("Considerar compresión para reducir tamaño de archivo")
        
        # Analizar materiales
        if not material_metadata.get('has_textures'):
            recommendations.append("Agregar texturas para mejorar visualización")
        
        # Analizar propiedades
        collection = properties_bulk.get('data', {}).get('collection', [])
        if collection:
            # Verificar completitud de propiedades
            incomplete_elements = 0
            for item in collection:
                properties = item.get('properties', {})
                prop_count = sum(len(group) for group in properties.values() if isinstance(group, dict))
                if prop_count < 5:  # Threshold arbitrario
                    incomplete_elements += 1
            
            if incomplete_elements > len(collection) * 0.3:  # >30% incompletos
                recommendations.append("Muchos elementos tienen propiedades incompletas")
        
        # Recomendaciones de rendimiento
        element_count = len(collection)
        if element_count > 10000:
            recommendations.append("Modelo muy complejo - considerar LOD para mejor rendimiento")
        elif element_count < 100:
            recommendations.append("Modelo simple - puede beneficiarse de más detalle")
        
        return recommendations
    
    async def close(self):
        """Cerrar cliente HTTP"""
        if self.client:
            await self.client.aclose()
            self.client = None


# Instancia global del extractor
metadata_extractor = MetadataExtractor()

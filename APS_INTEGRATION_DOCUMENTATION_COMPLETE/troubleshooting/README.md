# Guía de Resolución de Problemas - Plataforma de Integración APS

Esta guía proporciona información detallada para identificar, diagnosticar y resolver los problemas más comunes que pueden surgir durante el uso de la Plataforma de Integración APS.

## Índice de Contenidos

1. [Introducción](#introducción)
2. [Problemas de Autenticación](#problemas-de-autenticación)
3. [Problemas de Upload de Archivos](#problemas-de-upload-de-archivos)
4. [Problemas de Traducción de Modelos](#problemas-de-traducción-de-modelos)
5. [Problemas del Visualizador](#problemas-del-visualizador)
6. [Problemas de Rendimiento](#problemas-de-rendimiento)
7. [Problemas de Conectividad](#problemas-de-conectividad)
8. [Errores Comunes y Soluciones](#errores-comunes-y-soluciones)
9. [Herramientas de Diagnóstico](#herramientas-de-diagnóstico)
10. [Contacto de Soporte](#contacto-de-soporte)

## Introducción

Esta guía está diseñada para ayudar a usuarios y administradores a solucionar problemas que puedan surgir durante el uso de la Plataforma de Integración APS. Cada sección aborda una categoría específica de problemas, proporcionando diagnósticos y soluciones paso a paso.

### Cómo Usar Esta Guía

1. Identifique la categoría que mejor describe su problema
2. Siga los pasos de diagnóstico para confirmar la causa
3. Aplique las soluciones recomendadas
4. Si el problema persiste, recopile la información de diagnóstico sugerida y contacte al soporte

### Información de Diagnóstico Útil

Cuando reporte un problema, incluya siempre la siguiente información:

- **Descripción detallada**: Qué estaba haciendo cuando ocurrió el problema
- **Mensajes de error**: Texto exacto de cualquier mensaje de error
- **Capturas de pantalla**: Imágenes que muestren el problema
- **Navegador y versión**: (ej. Chrome 120.0.6099.109)
- **Sistema operativo**: (ej. Windows 11, macOS 13.4)
- **Logs relevantes**: Si tiene acceso a logs del sistema

## Problemas de Autenticación

### No Puedo Iniciar Sesión

#### Síntomas
- Mensaje de error "Credenciales inválidas"
- Redirección constante a la página de login
- Sesión se cierra inesperadamente

#### Diagnóstico
1. Verifique que está usando el correo electrónico correcto
2. Compruebe que el bloqueo de mayúsculas no esté activado
3. Confirme que su cuenta no esté bloqueada o inactiva

#### Soluciones
1. **Restablecer contraseña**:
   - Haga clic en "¿Olvidó su contraseña?"
   - Siga las instrucciones enviadas por correo electrónico
   
2. **Limpiar cookies y caché**:
   - En Chrome: Configuración > Privacidad y seguridad > Borrar datos de navegación
   - Seleccione "Cookies" y "Caché" y haga clic en "Borrar datos"
   
3. **Probar en modo incógnito**:
   - Abra una ventana de navegación privada/incógnito
   - Intente iniciar sesión nuevamente

4. **Contactar administrador**:
   - Si el problema persiste, su cuenta podría estar bloqueada
   - Contacte al administrador del sistema

### Error en Autenticación con APS

#### Síntomas
- Mensaje "Error al conectar con Autodesk Platform Services"
- No se pueden cargar modelos en el visualizador
- Error "No autorizado" al acceder a funciones de APS

#### Diagnóstico
1. Verifique que ha completado el proceso de autorización con Autodesk
2. Compruebe si los tokens de APS han expirado
3. Confirme que tiene los permisos necesarios en la plataforma

#### Soluciones
1. **Reautorizar con Autodesk**:
   - Vaya a "Perfil > Conexiones"
   - Haga clic en "Reconectar" junto a Autodesk
   - Complete el proceso de autorización
   
2. **Renovar sesión**:
   - Cierre sesión completamente
   - Inicie sesión nuevamente
   - Autorice nuevamente con Autodesk cuando se solicite
   
3. **Verificar permisos**:
   - Contacte al administrador para verificar que tiene los permisos necesarios
   - Solicite acceso a los buckets o proyectos necesarios

### Problemas con Autenticación de Dos Factores (2FA)

#### Síntomas
- No recibe códigos 2FA
- Los códigos 2FA no son aceptados
- Mensaje "Código expirado" o "Código inválido"

#### Diagnóstico
1. Verifique que la hora de su dispositivo esté sincronizada
2. Compruebe la recepción de mensajes SMS o correos electrónicos
3. Confirme que está usando la aplicación autenticadora correcta

#### Soluciones
1. **Sincronizar reloj del dispositivo**:
   - En dispositivos móviles, active la hora automática en configuración
   - En computadoras, sincronice el reloj con servidores de tiempo
   
2. **Usar códigos de respaldo**:
   - Si configuró códigos de respaldo, úselos para iniciar sesión
   - Después de iniciar sesión, configure 2FA nuevamente
   
3. **Contactar al administrador**:
   - Si no puede acceder, solicite al administrador que desactive 2FA para su cuenta
   - Reconfigure 2FA después de iniciar sesión

## Problemas de Upload de Archivos

### No Puedo Subir Archivos

#### Síntomas
- Error "Upload fallido" o "Archivo rechazado"
- La barra de progreso se detiene a mitad del proceso
- La página se recarga durante la subida

#### Diagnóstico
1. Verifique el tamaño del archivo (límite estándar: 5GB)
2. Compruebe que el formato de archivo sea soportado
3. Verifique la estabilidad de su conexión a internet
4. Confirme que tiene espacio disponible en su cuota

#### Soluciones
1. **Verificar límites**:
   - Consulte la documentación para límites de tamaño de archivo
   - Vea su cuota disponible en "Perfil > Cuota"
   
2. **Usar upload chunked para archivos grandes**:
   - Haga clic en "Upload Avanzado" en lugar de arrastrar archivos
   - Active la opción "Upload Chunked" para archivos >500MB
   
3. **Convertir formato si es necesario**:
   - Si el formato no es soportado directamente, convierta a un formato compatible
   - Consulte la lista de formatos soportados en la documentación
   
4. **Probar en red estable**:
   - Use una conexión cableada en lugar de Wi-Fi si es posible
   - Evite redes públicas o congestionadas para archivos grandes

### Archivos Subidos con Errores

#### Síntomas
- Archivo se sube pero aparece como "Error" o "Corrupto"
- El archivo no se puede procesar o visualizar
- Metadatos incorrectos o incompletos

#### Diagnóstico
1. Verifique que el archivo no esté dañado en el origen
2. Compruebe si el archivo está protegido o encriptado
3. Verifique si el archivo cumple con las especificaciones de formato

#### Soluciones
1. **Verificar archivo original**:
   - Abra el archivo en su aplicación nativa para confirmar que funciona
   - Guarde una nueva copia del archivo
   
2. **Quitar protección**:
   - Si el archivo tiene contraseña o protección, quítela antes de subir
   - Verifique que no tenga restricciones DRM
   
3. **Intentar con otro formato**:
   - Exporte el archivo a otro formato compatible
   - Intente con una versión anterior del formato

### Upload Lento

#### Síntomas
- Tiempos de subida excesivamente largos
- Barra de progreso avanza muy lentamente
- Subidas que se detienen y reanudan

#### Diagnóstico
1. Pruebe la velocidad de su conexión a internet
2. Verifique si hay congestión en la red
3. Compruebe si hay procesos que consumen ancho de banda

#### Soluciones
1. **Optimizar conexión**:
   - Use una conexión por cable en lugar de Wi-Fi
   - Cierre aplicaciones que consuman ancho de banda
   - Intente en horarios de menor congestión
   
2. **Comprimir archivos grandes**:
   - Comprima los archivos antes de subirlos (ZIP, RAR)
   - Divida archivos muy grandes en partes
   
3. **Usar upload chunked**:
   - Active la opción de "Upload Chunked" para mayor estabilidad
   - Esta opción permite reanudar subidas interrumpidas

## Problemas de Traducción de Modelos

### Traducción Fallida

#### Síntomas
- Estado "Failed" en la lista de traducciones
- Mensaje "Translation Error" o código de error específico
- El modelo no se puede visualizar después de la subida

#### Diagnóstico
1. Verifique los logs de traducción en detalles del archivo
2. Compruebe si el archivo tiene problemas de compatibilidad
3. Verifique si hay problemas con el servicio de APS

#### Soluciones
1. **Revisar mensaje de error específico**:
   - Haga clic en "Ver detalles" junto al estado de traducción
   - Anote el código de error exacto
   
2. **Intentar con configuración básica**:
   - Haga clic en "Reintentar traducción"
   - Seleccione "Configuración básica"
   - Desactive opciones avanzadas
   
3. **Verificar archivo original**:
   - Abra el archivo en su aplicación nativa
   - Repare problemas si los hay
   - Guarde como una versión más compatible (ej. versión anterior)
   
4. **Verificar estado de APS**:
   - Consulte [Autodesk Health Dashboard](https://health.autodesk.com/)
   - Espere si hay problemas de servicio reportados

### Traducción Atascada

#### Síntomas
- Estado "En progreso" durante horas
- Barra de progreso detenida en cierto porcentaje
- Sin mensajes de error pero sin completarse

#### Diagnóstico
1. Verifique el tamaño y complejidad del modelo
2. Compruebe el estado del servicio de APS
3. Verifique los límites de tiempo configurados

#### Soluciones
1. **Esperar para modelos grandes**:
   - Modelos muy grandes (>500MB) pueden tardar horas
   - Modelos Revit complejos pueden tardar más tiempo
   
2. **Cancelar y reintentar**:
   - Haga clic en "Cancelar traducción"
   - Espere a que se complete la cancelación
   - Haga clic en "Reintentar traducción"
   
3. **Usar configuración optimizada**:
   - Al reintentar, seleccione "Optimizado para rendimiento"
   - Reduzca la calidad si no es crítica
   
4. **Verificar timeout configurado**:
   - Si es administrador, verifique el timeout en configuración
   - Aumente si es necesario para modelos grandes

### Resultados de Traducción Incompletos

#### Síntomas
- El modelo se traduce pero faltan componentes
- Texturas o materiales ausentes
- Metadatos o propiedades incompletos

#### Diagnóstico
1. Verifique la complejidad y estructura del modelo
2. Compruebe si las texturas están enlazadas correctamente
3. Verifique la configuración de traducción utilizada

#### Soluciones
1. **Usar configuración de alta calidad**:
   - Reintentar con "Configuración de alta calidad"
   - Active la opción "Incluir materiales y texturas"
   
2. **Verificar enlaces de textura**:
   - Asegúrese que las texturas estén correctamente vinculadas en el original
   - Use rutas relativas para texturas
   
3. **Revisar estructura del modelo**:
   - Simplifique jerarquías muy complejas
   - Divida modelos extremadamente grandes
   
4. **Verificar formato de origen**:
   - Algunos formatos tienen mejor compatibilidad que otros
   - Considere convertir a un formato con mejor soporte

## Problemas del Visualizador

### El Visualizador No Carga

#### Síntomas
- Pantalla en blanco o negra donde debería estar el modelo
- Mensaje "Error al cargar el viewer"
- Indicador de carga que nunca termina

#### Diagnóstico
1. Verifique si el navegador es compatible
2. Compruebe si JavaScript está habilitado
3. Verifique si hay problemas de red o firewall
4. Compruebe la compatibilidad con WebGL

#### Soluciones
1. **Verificar navegador**:
   - Use Chrome, Firefox, Edge o Safari actualizados
   - Actualice su navegador a la última versión
   
2. **Habilitar JavaScript**:
   - Verifique que JavaScript esté habilitado en su navegador
   - Desactive bloqueadores de scripts si los usa
   
3. **Verificar WebGL**:
   - Visite [WebGL Report](https://webglreport.com/) para verificar compatibilidad
   - Actualice controladores de gráficos si es necesario
   
4. **Limpiar caché**:
   - Borre el caché del navegador
   - Intente en modo incógnito

### Rendimiento Lento del Visualizador

#### Síntomas
- Navegación entrecortada o lenta
- Retrasos al rotar o hacer zoom
- Alto uso de CPU o memoria

#### Diagnóstico
1. Verifique el tamaño y complejidad del modelo
2. Compruebe los recursos de su sistema (CPU, RAM, GPU)
3. Verifique la configuración de calidad del visualizador

#### Soluciones
1. **Ajustar configuración de gráficos**:
   - Haga clic en configuración del visualizador
   - Seleccione "Rendimiento" en lugar de "Calidad"
   - Reduzca la resolución de textura
   
2. **Simplificar vista**:
   - Oculte componentes no esenciales
   - Use la función "Aislar" para ver solo partes relevantes
   
3. **Dividir modelos grandes**:
   - Para modelos extremadamente grandes, considere dividirlos
   - Cargue solo las partes necesarias
   
4. **Actualizar hardware**:
   - Use un equipo con mejor GPU si es posible
   - Cierre aplicaciones en segundo plano para liberar recursos

### Problemas con Extensiones del Visualizador

#### Síntomas
- Las herramientas específicas no funcionan (medición, sección)
- Errores al activar ciertas extensiones
- Funcionalidades que desaparecen o fallan

#### Diagnóstico
1. Verifique si la extensión es compatible con el formato del modelo
2. Compruebe si hay conflictos entre extensiones
3. Verifique los permisos necesarios para la extensión

#### Soluciones
1. **Reiniciar extensiones**:
   - Desactive todas las extensiones
   - Recargue el visualizador
   - Active las extensiones una por una
   
2. **Verificar compatibilidad**:
   - No todas las extensiones funcionan con todos los formatos
   - Consulte la documentación para compatibilidad
   
3. **Actualizar extensiones**:
   - Si es administrador, verifique que las extensiones estén actualizadas
   - Consulte por actualizaciones en la configuración

## Problemas de Rendimiento

### Lentitud General de la Aplicación

#### Síntomas
- Tiempos de carga prolongados
- Interfaz que responde lentamente
- Acciones que tardan más de lo esperado

#### Diagnóstico
1. Verifique la velocidad de su conexión a internet
2. Compruebe los recursos de su sistema
3. Verifique si el problema ocurre en todos los navegadores
4. Compruebe si hay muchas pestañas o aplicaciones abiertas

#### Soluciones
1. **Optimizar navegador**:
   - Cierre pestañas innecesarias
   - Reinicie el navegador
   - Limpie caché y cookies
   
2. **Verificar recursos del sistema**:
   - Cierre aplicaciones en segundo plano
   - Verifique uso de CPU, memoria y disco
   - Reinicie el equipo si es necesario
   
3. **Usar modo ligero**:
   - Active "Modo ligero" en configuración de la aplicación
   - Reduzca animaciones y efectos visuales
   
4. **Probar otro navegador**:
   - Intente con un navegador diferente
   - Chrome y Firefox suelen tener mejor rendimiento

### Problemas con Proyectos Grandes

#### Síntomas
- Lentitud al cargar proyectos con muchos archivos
- Tiempos de respuesta largos al navegar entre modelos
- Errores de timeout en operaciones

#### Diagnóstico
1. Verifique el número de archivos en el proyecto
2. Compruebe el tamaño total del proyecto
3. Verifique si hay modelos particularmente grandes

#### Soluciones
1. **Organizar en subcarpetas**:
   - Divida proyectos grandes en carpetas lógicas
   - Evite tener cientos de archivos en una sola vista
   
2. **Usar filtros y búsqueda**:
   - Filtre por tipo de archivo o fecha
   - Use la búsqueda para encontrar archivos específicos
   
3. **Cargar bajo demanda**:
   - Configure la opción "Cargar vista previa bajo demanda"
   - Esto reduce la carga inicial de metadatos
   
4. **Archivar modelos antiguos**:
   - Mueva archivos no utilizados a un proyecto de archivo
   - Mantenga activos solo los modelos necesarios

## Problemas de Conectividad

### Desconexiones Frecuentes

#### Síntomas
- Mensajes de "Conexión perdida"
- Necesidad de iniciar sesión repetidamente
- Pérdida de datos no guardados

#### Diagnóstico
1. Verifique la estabilidad de su conexión a internet
2. Compruebe si hay problemas con el proxy o firewall
3. Verifique si su red bloquea WebSockets

#### Soluciones
1. **Verificar conexión**:
   - Pruebe su velocidad de internet
   - Reinicie su router si es necesario
   - Use una conexión más estable
   
2. **Ajustar configuración de red**:
   - Verifique que los puertos necesarios estén abiertos
   - Consulte con IT si hay restricciones de firewall
   
3. **Habilitar reconexión automática**:
   - Active "Reconexión automática" en configuración
   - Esto permite restaurar la sesión automáticamente
   
4. **Guardar frecuentemente**:
   - Use el guardado automático cuando esté disponible
   - Guarde manualmente su trabajo con frecuencia

### Problemas de Acceso desde Redes Corporativas

#### Síntomas
- No puede acceder desde la red de la empresa
- Funciona desde casa pero no desde la oficina
- Errores de conexión específicos de la red

#### Diagnóstico
1. Verifique si la red corporativa tiene restricciones
2. Compruebe si se requiere configuración de proxy
3. Verifique si los dominios necesarios están permitidos

#### Soluciones
1. **Consultar con IT**:
   - Proporcione la lista de dominios requeridos al departamento de IT
   - Solicite la apertura de puertos necesarios
   
2. **Configurar proxy**:
   - Configure el proxy en su navegador si es necesario
   - Solicite asistencia a IT para configuración específica
   
3. **Usar VPN**:
   - Si está permitido, use VPN para evitar restricciones
   - Confirme que la VPN no tenga restricciones similares

## Errores Comunes y Soluciones

### Códigos de Error y Significado

| Código | Descripción | Solución |
|--------|-------------|----------|
| `AUTH_001` | Credenciales inválidas | Verifique usuario/contraseña o restablezca contraseña |
| `AUTH_002` | Sesión expirada | Inicie sesión nuevamente |
| `AUTH_003` | Sin autorización | Solicite los permisos necesarios |
| `FILE_001` | Archivo demasiado grande | Reduzca tamaño o use upload chunked |
| `FILE_002` | Tipo de archivo no soportado | Verifique formatos soportados o convierta el archivo |
| `FILE_003` | Error durante upload | Verifique conexión y reintente |
| `TRANS_001` | Error iniciando traducción | Verifique permisos de APS y configuración |
| `TRANS_002` | Timeout de traducción | Reintente con modelo simplificado o espere más |
| `TRANS_003` | Formato no válido para traducción | Convierta a formato soportado |
| `VIEW_001` | Error cargando visualizador | Verifique WebGL y compatibilidad del navegador |
| `VIEW_002` | Error cargando modelo | Verifique traducción completa y formato |
| `API_001` | Error de API | Verifique parámetros y reintente |
| `APS_001` | Error de servicio APS | Verifique estado de APS y reintente más tarde |

### Mensajes de Error Comunes

#### "No se puede establecer una conexión segura"
- **Causa**: Problemas con certificados SSL o configuración de seguridad
- **Solución**: Verifique que su navegador esté actualizado, limpie caché SSL

#### "El modelo es demasiado grande para visualizar"
- **Causa**: El modelo excede los límites de memoria del navegador
- **Solución**: Simplifique el modelo, use un equipo más potente o divida en partes

#### "Error 403: Acceso prohibido"
- **Causa**: Falta de permisos para el recurso solicitado
- **Solución**: Solicite los permisos necesarios al administrador

#### "La operación no pudo completarse debido a una desconexión"
- **Causa**: Problemas de red durante una operación
- **Solución**: Verifique su conexión y reintente, use una red más estable

## Herramientas de Diagnóstico

### Recopilación de Información de Sistema

Para diagnósticos avanzados, puede generar un informe de sistema:

1. Vaya a "Ayuda > Soporte"
2. Haga clic en "Generar Informe de Diagnóstico"
3. Guarde el archivo generado
4. Comparta este archivo con soporte técnico cuando se solicite

Este informe incluye:
- Información del navegador y sistema operativo
- Versiones de componentes
- Logs de errores recientes
- Configuración del sistema (sin datos sensibles)

### Herramientas de Red

Para problemas de conectividad:

1. **Console del Navegador**:
   - Abra las herramientas de desarrollador (F12 en la mayoría de navegadores)
   - Vaya a la pestaña "Network"
   - Reproduzca el problema
   - Verifique solicitudes con error (rojo)
   
2. **Test de Conectividad**:
   - Vaya a "Ayuda > Diagnóstico > Test de Red"
   - Ejecute la prueba completa
   - Revise los resultados para identificar problemas específicos

### Modo Verbose

Para problemas complejos, active el modo de logging detallado:

1. Vaya a "Configuración > Avanzado"
2. Active "Modo de Depuración"
3. Reproduzca el problema
4. Vaya a "Ayuda > Logs de Depuración"
5. Descargue los logs completos
6. Comparta estos logs con soporte técnico

## Contacto de Soporte

Si no puede resolver el problema con esta guía, contacte al soporte técnico:

### Antes de Contactar

Recopile la siguiente información:
1. Descripción detallada del problema
2. Pasos para reproducir el problema
3. Capturas de pantalla relevantes
4. Informe de diagnóstico (ver sección anterior)
5. Códigos de error específicos
6. Acciones ya intentadas para resolver el problema

### Canales de Soporte

- **Soporte por Email**: soporte@suempresa.com
- **Portal de Soporte**: https://soporte.suempresa.com
- **Teléfono de Soporte**: +1 (555) 123-4567
- **Horario de Atención**: Lunes a Viernes, 9:00 a 18:00 (UTC-5)

### Niveles de Prioridad

Al reportar un problema, indique su nivel de prioridad:

1. **Crítico**: Sistema completamente inutilizable, impacto en producción
2. **Alto**: Funcionalidad principal afectada, existe workaround
3. **Medio**: Funcionalidad secundaria afectada, no impide trabajo
4. **Bajo**: Preguntas generales, mejoras sugeridas

Los tiempos de respuesta varían según el nivel de prioridad y su contrato de soporte.